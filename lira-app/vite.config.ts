import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { createSpaceStore, readStore, writeStore } from './server/diskStore.ts'

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
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const result = saveAllDataToDisk(data.spaces || [], data.issues || [])
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to write space data files' }))
            }
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
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { files } = JSON.parse(body)
              const written = writeStore(dataDir, files || {})
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, written }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to write store files' }))
            }
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
})
