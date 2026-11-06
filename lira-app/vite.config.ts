import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { createSpaceStore, readStore, writeStore } from './server/diskStore.ts'
import os from 'os'
import { checkApiRequest, hasPrototypePollution, isThisComputer, LOCKED_PAGE, lanGate, loadLanToken, readBody, securityHeaders, writeAudit } from './server/guard.ts'

// `npm run dev:lan` (vite --host) also lets your own tablet and phone in. Off by default.
const LAN = process.argv.includes('--host')

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
      const lanToken = LAN ? loadLanToken(dataDir) : ''
      if (LAN) {
        server.httpServer?.once('listening', () => {
          const port = (server.httpServer?.address() as { port: number } | null)?.port ?? 5173
          const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i!.address)
          console.log('\n  Lira is open to your network. On the tablet or phone (same Wi-Fi) open:')
          ips.forEach(ip => console.log(`    http://${ip}:${port}/?key=${lanToken}`))
          console.log('  Keep this link private: anyone with it can read and change your tickets.\n')
        })
      }

      // First in line: security headers on everything, and only Lira itself may use the /api routes
      server.middlewares.use((req, res, next) => {
        for (const [k, v] of Object.entries(securityHeaders(true))) res.setHeader(k, v)
        if (LAN && !isThisComputer(req.socket.remoteAddress)) {
          // other devices need the secret link (a cookie remembers it afterwards)
          const gate = lanGate({ url: req.url || '/', cookie: req.headers.cookie, remoteAddress: req.socket.remoteAddress, token: lanToken })
          if (gate.action === 'login') {
            res.statusCode = 302
            res.setHeader('Set-Cookie', gate.cookie)
            res.setHeader('Location', gate.redirect)
            res.end()
            return
          }
          if (gate.action === 'deny') {
            res.statusCode = 401
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(LOCKED_PAGE)
            return
          }
        }
        if (req.url?.startsWith('/api/')) {
          const verdict = checkApiRequest(req, { lan: LAN })
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

        // GET /api/lan - the links for other devices. Only this computer may ask, because the links contain the secret.
        if (req.method === 'GET' && url === '/api/lan') {
          res.setHeader('Content-Type', 'application/json')
          if (!isThisComputer(req.socket.remoteAddress)) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Request refused' })); return }
          const port = (server.httpServer?.address() as { port: number } | null)?.port ?? 5173
          const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i!.address)
          res.end(JSON.stringify({ lan: LAN, urls: LAN ? ips.map(ip => `http://${ip}:${port}/?key=${lanToken}`) : [] }))
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
          const files = readStore(dataDir) as Record<string, unknown>
          if (!isThisComputer(req.socket.remoteAddress)) delete files.secrets // a tablet does not need your API key
          res.end(JSON.stringify({ files }))
          return
        }

        // POST /api/kv - persist those files (only changed ones are rewritten)
        if (req.method === 'POST' && url === '/api/kv') {
          readBody(req).then(body => {
            try {
              const { files } = JSON.parse(body)
              if (files && !isThisComputer(req.socket.remoteAddress)) delete files.secrets
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
  server: { host: LAN ? true : 'localhost' },
  build: { sourcemap: false },
})
