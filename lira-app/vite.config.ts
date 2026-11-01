import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

function localFileDbPlugin(): Plugin {
  // Sharded database directory structure:
  // - data/spaces.json              <- Manifest of all spaces
  // - data/spaces/<KEY>.json        <- Space-segregated issues (e.g. AI.json, CERT.json, etc.)
  // - data/lira-workspace.json      <- Legacy fallback file
  const dataDir = path.resolve(process.cwd(), '../data')
  const spacesDir = path.resolve(dataDir, 'spaces')
  const spacesManifestFile = path.resolve(dataDir, 'spaces.json')
  const legacyDataFile = path.resolve(dataDir, 'lira-workspace.json')

  const ensureDirs = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    if (!fs.existsSync(spacesDir)) {
      fs.mkdirSync(spacesDir, { recursive: true })
    }
  }

  function loadAllDataFromDisk() {
    ensureDirs()

    // 1. Primary: Load from spaces.json manifest and individual space files
    if (fs.existsSync(spacesManifestFile) && fs.existsSync(spacesDir)) {
      try {
        const manifestRaw = fs.readFileSync(spacesManifestFile, 'utf-8')
        const manifest = JSON.parse(manifestRaw)
        const spaces: any[] = manifest.spaces || []
        const allIssues: any[] = []

        // Read each space's JSON file
        for (const space of spaces) {
          const key = String(space.key || `SPACE-${space.id}`).toUpperCase()
          const spaceFile = path.resolve(spacesDir, `${key}.json`)
          if (fs.existsSync(spaceFile)) {
            try {
              const spaceRaw = fs.readFileSync(spaceFile, 'utf-8')
              const parsed = JSON.parse(spaceRaw)
              const issues = Array.isArray(parsed) ? parsed : (parsed.issues || [])
              allIssues.push(...issues)
            } catch (err) {
              console.error(`[LocalFileDB] Error reading space file ${spaceFile}:`, err)
            }
          }
        }

        // Check for any orphan issues file
        const orphanFile = path.resolve(spacesDir, '_orphans.json')
        if (fs.existsSync(orphanFile)) {
          try {
            const orphanRaw = fs.readFileSync(orphanFile, 'utf-8')
            const parsed = JSON.parse(orphanRaw)
            const orphans = Array.isArray(parsed) ? parsed : (parsed.issues || [])
            allIssues.push(...orphans)
          } catch (err) {
            console.error('[LocalFileDB] Error reading orphan issues file:', err)
          }
        }

        return {
          version: '2.0.0',
          savedAt: manifest.savedAt || new Date().toISOString(),
          filePath: 'data/spaces/*.json',
          spaces,
          issues: allIssues,
        }
      } catch (err) {
        console.warn('[LocalFileDB] Error loading space files, checking legacy file:', err)
      }
    }

    // 2. Fallback: Load from legacy monolithic lira-workspace.json
    if (fs.existsSync(legacyDataFile)) {
      try {
        const content = fs.readFileSync(legacyDataFile, 'utf-8')
        const parsed = JSON.parse(content)
        // Automatically migrate to space-segregated files
        if (parsed.spaces && Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
          saveAllDataToDisk(parsed.spaces, parsed.issues || [])
        }
        return parsed
      } catch (err) {
        console.error('[LocalFileDB] Error reading legacy data file:', err)
      }
    }

    return { exists: false, spaces: [], issues: [] }
  }

  function saveAllDataToDisk(spaces: any[], issues: any[]) {
    ensureDirs()
    const nowIso = new Date().toISOString()

    // Map spaceId -> space
    const spaceMap = new Map<number, any>()
    spaces.forEach(s => spaceMap.set(s.id, s))

    // Group issues by spaceId
    const issuesBySpaceId = new Map<number, any[]>()
    spaces.forEach(s => issuesBySpaceId.set(s.id, []))

    const orphanIssues: any[] = []
    issues.forEach(issue => {
      if (issuesBySpaceId.has(issue.spaceId)) {
        issuesBySpaceId.get(issue.spaceId)!.push(issue)
      } else {
        orphanIssues.push(issue)
      }
    })

    const activeFiles = new Set<string>()
    const manifestSpaces: any[] = []

    // 1. Write each space's dedicated JSON file
    for (const space of spaces) {
      const key = String(space.key || `SPACE-${space.id}`).toUpperCase()
      const fileName = `${key}.json`
      const filePath = path.resolve(spacesDir, fileName)
      activeFiles.add(fileName)

      const spaceIssues = issuesBySpaceId.get(space.id) || []
      const spacePayload = {
        version: '2.0.0',
        spaceId: space.id,
        spaceKey: space.key,
        spaceName: space.name,
        updatedAt: nowIso,
        issueCount: spaceIssues.length,
        space: space,
        issues: spaceIssues,
      }

      fs.writeFileSync(filePath, JSON.stringify(spacePayload, null, 2), 'utf-8')

      manifestSpaces.push({
        ...space,
        issueCount: spaceIssues.length,
        file: `spaces/${fileName}`,
      })
    }

    // 2. Write orphan issues if any exist
    if (orphanIssues.length > 0) {
      const orphanFile = path.resolve(spacesDir, '_orphans.json')
      activeFiles.add('_orphans.json')
      fs.writeFileSync(orphanFile, JSON.stringify({
        version: '2.0.0',
        updatedAt: nowIso,
        count: orphanIssues.length,
        issues: orphanIssues,
      }, null, 2), 'utf-8')
    }

    // 3. Write spaces.json manifest
    const manifestPayload = {
      version: '2.0.0',
      savedAt: nowIso,
      spaceCount: spaces.length,
      totalIssueCount: issues.length,
      spaces: manifestSpaces,
    }
    fs.writeFileSync(spacesManifestFile, JSON.stringify(manifestPayload, null, 2), 'utf-8')

    // 4. Safely clean up removed space files
    try {
      const existingFiles = fs.readdirSync(spacesDir)
      for (const file of existingFiles) {
        if (file.endsWith('.json') && !activeFiles.has(file)) {
          fs.unlinkSync(path.resolve(spacesDir, file))
        }
      }
    } catch (err) {
      console.warn('[LocalFileDB] Stale file cleanup warning:', err)
    }

    // 5. Also keep master consolidated lira-workspace.json in sync
    try {
      const consolidatedPayload = {
        version: '2.0.0',
        savedAt: nowIso,
        filePath: legacyDataFile,
        spaces,
        issues,
      }
      fs.writeFileSync(legacyDataFile, JSON.stringify(consolidatedPayload, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[LocalFileDB] Error updating master lira-workspace.json:', err)
    }

    return {
      success: true,
      savedAt: nowIso,
      filePath: 'data/spaces/*.json',
      counts: {
        spaces: spaces.length,
        issues: issues.length,
        spaceFiles: manifestSpaces.length,
      },
    }
  }

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

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localFileDbPlugin()],
})
