/**
 * Disk persistence helpers used by the Vite dev-server plugin (vite.config.ts).
 * Kept free of Vite imports so they can be unit-tested.
 *
 * Files written (all under <repo>/data):
 *   projects.json, sprints.json, teams.json, standups.json, board-config.json, settings.json
 *   private/secrets.json   <- git-ignored (API keys)
 */
import fs from 'node:fs'
import path from 'node:path'

export const STORE_FILES = ['projects', 'sprints', 'teams', 'standups', 'board-config', 'settings', 'secrets'] as const
export type StoreFile = (typeof STORE_FILES)[number]
export type StoreEntries = Record<string, unknown>

export const isStoreFile = (name: string): name is StoreFile => (STORE_FILES as readonly string[]).includes(name)

export const storePath = (dataDir: string, name: StoreFile) =>
  name === 'secrets' ? path.join(dataDir, 'private', 'secrets.json') : path.join(dataDir, `${name}.json`)

/** Recursively sorts object keys so the same data always serialises identically (stable git diffs). */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object).sort().map(k => [k, sortKeys((value as Record<string, unknown>)[k])]),
    ) as T
  }
  return value
}

function readJson(file: string): any | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return undefined
  }
}

/** Reads every store file. Missing or corrupt files are skipped. */
export function readStore(dataDir: string): Record<string, StoreEntries> {
  const out: Record<string, StoreEntries> = {}
  for (const name of STORE_FILES) {
    const parsed = readJson(storePath(dataDir, name))
    if (parsed && typeof parsed.entries === 'object' && parsed.entries) out[name] = parsed.entries
  }
  return out
}

/**
 * Writes the given store files. A file is only touched when its entries actually changed,
 * and `updatedAt` only moves when they do. Returns the names that were written.
 */
export function writeStore(dataDir: string, files: Record<string, StoreEntries>, now = new Date()): string[] {
  const written: string[] = []
  for (const [name, entries] of Object.entries(files)) {
    if (!isStoreFile(name) || !entries || typeof entries !== 'object') continue
    const file = storePath(dataDir, name)
    const sorted = sortKeys(entries)
    const existing = readJson(file)
    if (existing && JSON.stringify(existing.entries) === JSON.stringify(sorted)) continue
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const payload = { version: 1, updatedAt: now.toISOString(), entries: sorted }
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
    written.push(name)
  }
  return written
}

/**
 * Writes `payload` as JSON unless the file already holds identical content,
 * ignoring the timestamp fields in `tsKeys` (so a save with no real change leaves git clean).
 */
export function writeJsonIfChanged(file: string, payload: Record<string, unknown>, tsKeys: string[] = []): boolean {
  const strip = (o: Record<string, unknown>) => {
    const c = { ...o }
    tsKeys.forEach(k => delete c[k])
    return JSON.stringify(c)
  }
  const existing = readJson(file)
  if (existing && typeof existing === 'object' && strip(existing) === strip(payload)) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')
  return true
}

/**
 * Tickets and spaces: data/spaces.json (manifest), data/spaces/<KEY>.json (one file per space) and the
 * consolidated data/lira-workspace.json. Every write goes through writeJsonIfChanged, so a save only
 * touches the files whose content really changed.
 */
export function createSpaceStore(dataDir: string) {
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

  function loadAllDataFromDisk(): any {
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

      writeJsonIfChanged(filePath, spacePayload, ['updatedAt'])

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
      writeJsonIfChanged(orphanFile, {
        version: '2.0.0',
        updatedAt: nowIso,
        count: orphanIssues.length,
        issues: orphanIssues,
      }, ['updatedAt'])
    }

    // 3. Write spaces.json manifest
    const manifestPayload = {
      version: '2.0.0',
      savedAt: nowIso,
      spaceCount: spaces.length,
      totalIssueCount: issues.length,
      spaces: manifestSpaces,
    }
    writeJsonIfChanged(spacesManifestFile, manifestPayload, ['savedAt'])

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
      writeJsonIfChanged(legacyDataFile, consolidatedPayload, ['savedAt'])
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

  return { ensureDirs, loadAllDataFromDisk, saveAllDataToDisk }
}
