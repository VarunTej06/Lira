import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { createSpaceStore, readStore, writeStore } from './server/diskStore.ts'
import { checkApiRequest, hasPrototypePollution, readBody, securityHeaders, writeAudit } from './server/guard.ts'

function localFileDbPlugin(): Plugin {
  // Sharded database directory structure:
  // - data/spaces.json              <- Manifest of all spaces
  // - data/spaces/<KEY>.json        <- Space-segregated issues (e.g. AI.json, CERT.json, etc.)
  // - data/lira-workspace.json      <- Legacy fallback file
  // Override with LIRA_DATA_DIR to keep the data somewhere else (for example when testing)
  const dataDir = process.env.LIRA_DATA_DIR ? path.resolve(process.env.LIRA_DATA_DIR) : path.resolve(process.cwd(), '../data')
  const spacesDir = path.resolve(dataDir, 'spaces')
  const spacesManifestFile = path.resolve(dataDir, 'spaces.json')

  const { ensureDirs, loadAllDataFromDisk, saveAllDataToDisk } = createSpaceStore(dataDir)

  return {
    name: 'local-file-db-plugin',
    configureServer(server) {
      // First in line: security headers on everything, and only Lira itself may use the /api routes
      server.middlewares.use((req, res, next) => {
        for (const [k, v] of Object.entries(securityHeaders(true))) res.setHeader(k, v)
        if (req.url?.startsWith('/api/')) {
          const verdict = checkApiRequest(req)
          if (!verdict.ok) {
            res.statusCode = verdict.status ?? 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Request refused' }))
            return
          }
        }
        next()
      })

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]

        // GET /api/health
        if (req.method === 'GET' && url === '/api/health') {
          ensureDirs()
          const data = loadAllDataFromDisk()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            status: 'ok',
            dataDir,
            spacesDir,
            spacesCount: (data.spaces || []).length,
            issuesCount: (data.issues || []).length,
          }))
          return
        }

        // GET /api/spaces - List all spaces from manifest
        if (req.method === 'GET' && url === '/api/spaces') {
          ensureDirs()
          if (fs.existsSync(spacesManifestFile)) {
            try {
              const content = fs.readFileSync(spacesManifestFile, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(content)
              return
            } catch {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to read spaces manifest' }))
              return
            }
          }
        }

        // GET /api/data - Load all spaces and issues (aggregated from space files)
        if (req.method === 'GET' && url === '/api/data') {
          try {
            const data = loadAllDataFromDisk()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to read data files' }))
            return
          }
        }

        // POST /api/save - Save to space-segregated files on PC disk
        if (req.method === 'POST' && url === '/api/save') {
          readBody(req).then(body => {
            const data = JSON.parse(body)
            if (!data || !Array.isArray(data.spaces ?? []) || !Array.isArray(data.issues ?? []) || hasPrototypePollution(data)) throw new Error('bad payload')
            const result = saveAllDataToDisk(data.spaces || [], data.issues || [])
            writeAudit(dataDir, 'save-tickets', [`${(data.spaces || []).length} spaces`, `${(data.issues || []).length} tickets`])
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          }).catch(() => {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to write space data files' }))
          })
          return
        }

        // GET /api/kv - every settings / projects / sprints / teams / standups file
        if (req.method === 'GET' && url === '/api/kv') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ files: readStore(dataDir) }))
          return
        }

        // POST /api/kv - persist those files (only changed ones are rewritten)
        if (req.method === 'POST' && url === '/api/kv') {
          readBody(req).then(body => {
            try {
              const { files } = JSON.parse(body)
              const written = writeStore(dataDir, files || {})
              writeAudit(dataDir, 'save-settings', written)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, written }))
            } catch (err) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to write store files' }))
            }
          }).catch(() => {
            res.statusCode = 413
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Request too large' }))
          })
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localFileDbPlugin()],
  // The API only exists in the dev server, so keep it on this computer. Never expose it on a network.
  server: { host: 'localhost' },
  build: { sourcemap: false },
})
