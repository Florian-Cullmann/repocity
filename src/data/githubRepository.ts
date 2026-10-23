import type { RepositorySnapshot, SoftwareModule } from '../domain/repository'
import {
  createSourceRepository,
  MAX_SOURCE_BYTES,
  measureSourceFile,
  sourceLanguage,
} from './sourceRepository.mjs'

export const MAX_GITHUB_FILES = 768
const MAX_TOTAL_BYTES = 32 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 120_000
const INVALID_REPOSITORY = 'Bitte eine GitHub-Repository-URL oder owner/repository eingeben.'

/** Accept repository homepages only; never use an arbitrary input URL as a fetch destination. */
export function parseGitHubRepository(input: string): string {
  let name = input.trim()
  if (/^(?:https?:\/\/|(?:www\.)?github\.com\/)/i.test(name)) {
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(name) ? name : `https://${name}`)
    } catch {
      throw new Error(INVALID_REPOSITORY)
    }
    if (
      !['github.com', 'www.github.com'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error(INVALID_REPOSITORY)
    name = url.pathname.slice(1)
  }
  name = name.replace(/\/$/, '').replace(/\.git$/i, '')
  const parts = name.split('/')
  if (
    parts.length !== 2 ||
    !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(parts[0]) ||
    !/^[\w.-]{1,100}$/.test(parts[1]) ||
    ['.', '..'].includes(parts[1])
  )
    throw new Error(INVALID_REPOSITORY)
  return name
}

interface ImportOptions {
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}
interface TreeEntry {
  path: string
  mode: string
  type: string
  size: number
}

function httpError(response: Response, file = false): Error {
  if (
    response.status === 429 ||
    (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
  ) {
    const reset = Number(response.headers.get('x-ratelimit-reset'))
    const minutes = reset > 0 ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60_000)) : null
    return new Error(
      `GitHub-Anfragelimit erreicht. Bitte ${minutes ? `in etwa ${minutes} Minuten` : 'später'} erneut versuchen.`,
    )
  }
  if (response.status === 404)
    return new Error(
      file
        ? 'Eine Quelldatei ist bei GitHub nicht verfügbar. Bitte den Import erneut starten.'
        : 'Repository nicht gefunden oder nicht öffentlich. Bitte die GitHub-Adresse prüfen.',
    )
  if (response.status === 409)
    return new Error('Dieses Repository ist leer oder hat noch keinen Commit.')
  if (response.status === 403)
    return new Error('GitHub hat die Anfrage abgewiesen. Bitte später erneut versuchen.')
  return new Error(
    `GitHub ist momentan nicht erreichbar (HTTP ${response.status}). Bitte erneut versuchen.`,
  )
}

async function readSource(response: Response, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) {
    await response.body?.cancel()
    throw new Error('Eine Quelldatei überschreitet das Importlimit von 1 MiB.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GitHub hat keinen Dateiinhalt geliefert. Bitte erneut versuchen.')
  const decoder = new TextDecoder()
  const text: string[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SOURCE_BYTES)
        throw new Error('Eine Quelldatei überschreitet das Importlimit von 1 MiB.')
      text.push(decoder.decode(value, { stream: true }))
    }
    text.push(decoder.decode())
    return text.join('')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Three API requests plus bounded, concurrent raw downloads; no server or token required. */
export async function fetchGitHubRepository(
  input: string,
  options: ImportOptions = {},
): Promise<RepositorySnapshot> {
  const requestedName = parseGitHubRepository(input)
  const controller = new AbortController()
  const { signal } = controller
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, IMPORT_TIMEOUT_MS)
  const request = async (url: string, api = true) => {
    signal.throwIfAborted()
    const response = await fetch(url, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: api ? { Accept: 'application/vnd.github+json' } : undefined,
    })
    if (!response.ok) throw httpError(response, !api)
    return response
  }
  try {
    const metadata = await (await request(`https://api.github.com/repos/${requestedName}`)).json()
    if (
      metadata.private ||
      typeof metadata.full_name !== 'string' ||
      typeof metadata.default_branch !== 'string'
    )
      throw new Error('GitHub hat keine öffentlichen Repository-Daten geliefert.')
    const name = parseGitHubRepository(metadata.full_name)
    const base = `https://api.github.com/repos/${name}`
    const branch = await (
      await request(`${base}/branches/${encodeURIComponent(metadata.default_branch)}`)
    ).json()
    const commit = branch.commit?.sha
    const treeSha = branch.commit?.commit?.tree?.sha
    if (
      typeof commit !== 'string' ||
      !/^[a-f\d]{40,64}$/i.test(commit) ||
      typeof treeSha !== 'string' ||
      !/^[a-f\d]{40,64}$/i.test(treeSha)
    )
      throw new Error('GitHub hat keinen gültigen Commit geliefert.')
    const tree = await (await request(`${base}/git/trees/${treeSha}?recursive=1`)).json()
    if (tree.truncated)
      throw new Error('Die Dateistruktur dieses Repositories ist zu groß für den Browser-Import.')
    if (!Array.isArray(tree.tree))
      throw new Error('GitHub hat keine gültige Dateistruktur geliefert.')
    const files: TreeEntry[] = tree.tree
      .filter(
        (entry: TreeEntry) =>
          entry &&
          entry.type === 'blob' &&
          ['100644', '100755'].includes(entry.mode) &&
          typeof entry.path === 'string' &&
          sourceLanguage(entry.path) &&
          Number.isSafeInteger(entry.size) &&
          entry.size >= 0 &&
          entry.size <= MAX_SOURCE_BYTES,
      )
      .sort((a: TreeEntry, b: TreeEntry) => a.path.localeCompare(b.path, 'en'))
    if (files.length === 0)
      throw new Error('Keine unterstützten Quelldateien in diesem Repository gefunden.')
    // Sample across the sorted tree so large repositories retain multiple areas of the project.
    const count = Math.min(files.length, MAX_GITHUB_FILES)
    let bytes = 0
    const selected: TreeEntry[] = []
    for (let index = 0; index < count; index++) {
      const file = files[Math.floor((index * files.length) / count)]
      if (bytes + file.size > MAX_TOTAL_BYTES) continue
      selected.push(file)
      bytes += file.size
    }
    const modules: SoftwareModule[] = []
    let next = 0
    let loaded = 0
    options.onProgress?.(0, selected.length)
    const worker = async () => {
      while (next < selected.length) {
        signal.throwIfAborted()
        const file = selected[next++]
        const path = file.path.split('/').map(encodeURIComponent).join('/')
        const response = await request(
          `https://raw.githubusercontent.com/${name}/${commit}/${path}`,
          false,
        )
        const module = measureSourceFile(file.path, await readSource(response, signal))
        if (module) modules.push(module)
        options.onProgress?.(++loaded, selected.length)
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, selected.length) }, worker))
    signal.throwIfAborted()
    const snapshot = createSourceRepository(name, 'github', modules)
    snapshot.url = `https://github.com/${name}`
    snapshot.revision = { branch: metadata.default_branch, commit }
    if (modules.length < files.length)
      snapshot.notice = `${modules.length} von ${files.length} geeigneten Quelldateien angezeigt. Für große Repositories wird eine Auswahl geladen (maximal ${MAX_GITHUB_FILES} Dateien / 32 MiB); Binärdateien werden ausgelassen.`
    return snapshot
  } catch (error) {
    if (timedOut)
      throw new Error(
        'Das Laden dauert zu lange. Bitte erneut versuchen oder ein kleineres Repository wählen.',
      )
    if (options.signal?.aborted) throw options.signal.reason
    if (error instanceof TypeError)
      throw new Error(
        'Verbindung zu GitHub fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.',
      )
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    controller.abort()
  }
}
