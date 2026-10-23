import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

const languages = new Map([
  ['.ts', 'TypeScript'],
  ['.tsx', 'TypeScript'],
  ['.mts', 'TypeScript'],
  ['.cts', 'TypeScript'],
  ['.js', 'JavaScript'],
  ['.jsx', 'JavaScript'],
  ['.mjs', 'JavaScript'],
  ['.cjs', 'JavaScript'],
  ['.css', 'CSS'],
  ['.scss', 'SCSS'],
  ['.html', 'HTML'],
  ['.vue', 'Vue'],
  ['.svelte', 'Svelte'],
  ['.py', 'Python'],
  ['.go', 'Go'],
  ['.rs', 'Rust'],
  ['.java', 'Java'],
  ['.kt', 'Kotlin'],
  ['.swift', 'Swift'],
  ['.rb', 'Ruby'],
  ['.php', 'PHP'],
  ['.c', 'C'],
  ['.h', 'C'],
  ['.cpp', 'C++'],
  ['.hpp', 'C++'],
  ['.cs', 'C#'],
  ['.sh', 'Shell'],
  ['.sql', 'SQL'],
])
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  'vendor',
  'target',
  '__pycache__',
])
const colors = ['#ed9a72', '#b3a2d8', '#7dbab4', '#a9bc78', '#e9bd63', '#90b5d2']

/** @param {string} id */
function districtColor(id) {
  let hash = 0
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

/**
 * Counts non-empty source lines, including comments. Never executes project code.
 * Only relative paths and aggregate metrics are included in the snapshot.
 * @param {string} root
 * @param {{ name?: string }} [options]
 * @returns {Promise<import('../src/domain/repository').RepositorySnapshot>}
 */
export async function analyzeRepository(root, { name = basename(root) } = {}) {
  /** @type {import('../src/domain/repository').SoftwareModule[]} */
  const modules = []
  /** @type {Map<string, import('../src/domain/repository').District>} */
  const districts = new Map()

  /** @param {string[]} parts */
  async function walk(parts) {
    const entries = await readdir(join(root, ...parts), { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const next = [...parts, entry.name]
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) await walk(next)
        continue
      }
      // Symlinks are deliberately not followed, even when they point to source files.
      if (!entry.isFile()) continue
      const language = languages.get(extname(entry.name).toLowerCase())
      if (!language || /\.(min|generated)\.[^.]+$/i.test(entry.name)) continue
      const absolutePath = join(root, ...next)
      if ((await stat(absolutePath)).size > 1024 * 1024) continue
      const content = await readFile(absolutePath, 'utf8')
      if (content.includes('\0')) continue
      const lines = content.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0).length
      // Source roots such as src/ and app/ get one district per immediate subfolder.
      const districtId =
        parts.length === 0
          ? '.'
          : ['src', 'app', 'lib'].includes(parts[0]) && parts.length > 1
            ? parts.slice(0, 2).join('/')
            : parts[0]
      const districtName = districtId === '.' ? 'Projektwurzel' : districtId
      districts.set(districtId, {
        id: districtId,
        name: districtName,
        subtitle:
          districtId === '.' ? 'Dateien im Projektverzeichnis' : `Quellcode in ${districtId}`,
        color: districtColor(districtId),
      })
      const path = next.join('/')
      modules.push({
        id: path,
        name: entry.name,
        path,
        districtId,
        language,
        description: `Quelldatei aus ${districtName}. ${lines.toLocaleString('de-DE')} nichtleere Zeilen, einschließlich Kommentaren.`,
        metrics: { lines, files: 1, dependencies: null, coverage: null },
      })
    }
  }

  await walk([])
  if (modules.length === 0) throw new Error('Keine unterstützten Quelldateien gefunden.')
  return {
    name,
    source: 'local',
    districts: [...districts.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
    modules: modules.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  }
}
