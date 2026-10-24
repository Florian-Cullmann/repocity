import type { RepositorySnapshot, SoftwareModule } from '../domain/repository'
import {
  createSourceRepository,
  describeSourceFile,
  measureSourceFile,
  sourceLanguage,
} from './sourceRepository.mjs'

export const MAX_MEASUREMENT_BYTES = 8 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 120_000
const INVALID_REPOSITORY = 'Please enter a GitHub repository URL or owner/repository.'

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
      `GitHub rate limit reached. Please try again ${minutes ? `in about ${minutes} minutes` : 'later'}.`,
    )
  }
  if (response.status === 404)
    return new Error(
      file
        ? 'A source file is unavailable on GitHub. Please import the repository again.'
        : 'Repository not found or not public. Please check the GitHub address.',
    )
  if (response.status === 409) return new Error('This repository is empty or has no commits yet.')
  if (response.status === 403)
    return new Error('GitHub rejected the request. Please try again later.')
  return new Error(`GitHub is currently unavailable (HTTP ${response.status}). Please try again.`)
}

async function readSource(response: Response, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get('content-length')) > MAX_MEASUREMENT_BYTES) {
    await response.body?.cancel()
    throw new Error('A source file exceeds the 8 MiB measurement limit.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GitHub returned no file content. Please try again.')
  const decoder = new TextDecoder()
  const text: string[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_MEASUREMENT_BYTES)
        throw new Error('A source file exceeds the 8 MiB measurement limit.')
      text.push(decoder.decode(value, { stream: true }))
    }
    text.push(decoder.decode())
    return text.join('')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Import the complete eligible tree in three API requests, without raw downloads. */
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
  const request = async (url: string) => {
    signal.throwIfAborted()
    const response = await fetch(url, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw httpError(response)
    return response
  }
  try {
    const metadata = await (await request(`https://api.github.com/repos/${requestedName}`)).json()
    if (
      metadata.private ||
      typeof metadata.full_name !== 'string' ||
      typeof metadata.default_branch !== 'string'
    )
      throw new Error('GitHub returned no public repository data.')
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
      throw new Error('GitHub returned no valid commit.')
    const tree = await (await request(`${base}/git/trees/${treeSha}?recursive=1`)).json()
    if (tree.truncated)
      throw new Error('This repository file tree is too large to import in the browser.')
    if (!Array.isArray(tree.tree)) throw new Error('GitHub returned an invalid file tree.')
    const files: TreeEntry[] = tree.tree
      .filter(
        (entry: TreeEntry) =>
          entry &&
          entry.type === 'blob' &&
          ['100644', '100755'].includes(entry.mode) &&
          typeof entry.path === 'string' &&
          sourceLanguage(entry.path) &&
          Number.isSafeInteger(entry.size) &&
          entry.size >= 0,
      )
      .sort((a: TreeEntry, b: TreeEntry) => a.path.localeCompare(b.path, 'en'))
    if (files.length === 0) throw new Error('No supported source files found in this repository.')
    signal.throwIfAborted()
    const modules = files.map((file) => describeSourceFile(file.path, file.size)!)
    const snapshot = createSourceRepository(name, 'github', modules)
    snapshot.url = `https://github.com/${name}`
    snapshot.revision = { branch: metadata.default_branch, commit }
    snapshot.sizeMetric = 'bytes'
    options.onProgress?.(modules.length, modules.length)
    signal.throwIfAborted()
    return snapshot
  } catch (error) {
    if (timedOut)
      throw new Error('Loading timed out. Please try again or choose a smaller repository.')
    if (options.signal?.aborted) throw options.signal.reason
    if (error instanceof TypeError)
      throw new Error(
        'Could not connect to GitHub. Please check your internet connection and try again.',
      )
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    controller.abort()
  }
}

/** Read a single selected file at the imported commit; never execute repository code. */
export async function fetchGitHubFileLines(
  repository: RepositorySnapshot,
  module: SoftwareModule,
  signal?: AbortSignal,
): Promise<number> {
  const name = parseGitHubRepository(repository.name)
  const commit = repository.revision?.commit
  if (
    repository.source !== 'github' ||
    !commit ||
    !/^[a-f\d]{40,64}$/i.test(commit) ||
    !sourceLanguage(module.path)
  )
    throw new Error('This source file cannot be matched to the imported GitHub commit.')
  if ((module.metrics.bytes ?? 0) > MAX_MEASUREMENT_BYTES)
    throw new Error('This file exceeds 8 MiB. Lines of code cannot be measured here.')
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 30_000)
  try {
    controller.signal.throwIfAborted()
    const path = module.path.split('/').map(encodeURIComponent).join('/')
    const response = await fetch(`https://raw.githubusercontent.com/${name}/${commit}/${path}`, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw httpError(response, true)
    const measured = measureSourceFile(module.path, await readSource(response, controller.signal))
    if (!measured || measured.metrics.lines === null)
      throw new Error('This file contains binary data. Lines of code cannot be measured.')
    return measured.metrics.lines
  } catch (error) {
    if (timedOut) throw new Error('Measurement timed out. Please try again.')
    if (signal?.aborted) throw signal.reason
    if (error instanceof TypeError)
      throw new Error('Could not load the source file. Please check your connection.')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.abort()
  }
}
