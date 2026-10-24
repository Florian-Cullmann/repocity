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
export const MAX_SOURCE_BYTES = 1024 * 1024

/** @param {string} path */
export function isSourceDirectory(path) {
  return (
    path === '' ||
    path
      .split('/')
      .every(
        (part) =>
          part.length > 0 &&
          !part.startsWith('.') &&
          !part.includes('\\') &&
          !excludedDirectories.has(part),
      )
  )
}

/** @param {string} path */
export function sourceLanguage(path) {
  const parts = path.split('/')
  const name = parts.pop()
  if (!name || name.startsWith('.') || name.includes('\\') || !isSourceDirectory(parts.join('/')))
    return undefined
  if (/\.(min|generated)\.[^.]+$/i.test(name)) return undefined
  return languages.get(name.slice(name.lastIndexOf('.')).toLowerCase())
}

/** @param {string} path */
function districtId(path) {
  const parts = path.split('/').slice(0, -1)
  return parts.length === 0
    ? '.'
    : ['src', 'app', 'lib'].includes(parts[0]) && parts.length > 1
      ? parts.slice(0, 2).join('/')
      : parts[0]
}

/**
 * Describe every eligible file from tree metadata, without downloading its contents.
 * @param {string} path
 * @param {number} bytes
 * @returns {import('../domain/repository').SoftwareModule | null}
 */
export function describeSourceFile(path, bytes) {
  const language = sourceLanguage(path)
  if (!language) return null
  const district = districtId(path)
  return {
    id: path,
    name: path.split('/').at(-1) ?? path,
    path,
    districtId: district,
    language,
    description: `Source file from ${district === '.' ? 'Project root' : district}.`,
    metrics: { lines: null, bytes, files: 1, dependencies: null, coverage: null },
  }
}

/**
 * @param {string} path
 * @param {string} content
 * @returns {import('../domain/repository').SoftwareModule | null}
 */
export function measureSourceFile(path, content) {
  const language = sourceLanguage(path)
  if (!language || content.includes('\0')) return null
  const lines = content.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0).length
  const district = districtId(path)
  return {
    id: path,
    name: path.split('/').at(-1) ?? path,
    path,
    districtId: district,
    language,
    description: `Source file from ${district === '.' ? 'Project root' : district}. ${lines.toLocaleString('en-US')} non-empty lines, including comments.`,
    metrics: { lines, files: 1, dependencies: null, coverage: null },
  }
}

/**
 * @param {string} name
 * @param {'local' | 'github'} source
 * @param {import('../domain/repository').SoftwareModule[]} modules
 * @returns {import('../domain/repository').RepositorySnapshot}
 */
export function createSourceRepository(name, source, modules) {
  if (modules.length === 0) throw new Error('No supported source files found.')
  const districts = [...new Set(modules.map((module) => module.districtId))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  )
  return {
    name,
    source,
    districts: districts.map((id) => {
      let hash = 0
      for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
      return {
        id,
        name: id === '.' ? 'Project root' : id,
        subtitle: id === '.' ? 'Files in the project root' : `Source code in ${id}`,
        color: colors[hash % colors.length],
      }
    }),
    modules: [...modules].sort((a, b) => a.id.localeCompare(b.id, 'en')),
  }
}
