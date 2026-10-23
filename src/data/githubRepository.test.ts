import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchGitHubRepository,
  fetchGitHubFileLines,
  MAX_MEASUREMENT_BYTES,
  parseGitHubRepository,
} from './githubRepository'

const commit = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const base = 'https://api.github.com/repos/example/garden'
type File = { path: string; content?: string; size?: number; mode?: string; type?: string }

function github(files: File[], options: { truncated?: boolean; branch?: string } = {}) {
  const branch = options.branch ?? 'main'
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    init?.signal?.throwIfAborted()
    const url = String(input)
    if (url === base)
      return Response.json({ full_name: 'example/garden', default_branch: branch, private: false })
    if (url === `${base}/branches/${encodeURIComponent(branch)}`)
      return Response.json({ commit: { sha: commit, commit: { tree: { sha: treeSha } } } })
    if (url === `${base}/git/trees/${treeSha}?recursive=1`)
      return Response.json({
        truncated: options.truncated ?? false,
        tree: files.map((file) => ({
          type: 'blob',
          mode: '100644',
          size: new TextEncoder().encode(file.content ?? 'source\n').byteLength,
          ...file,
        })),
      })
    const file = files.find(
      (file) =>
        url ===
        `https://raw.githubusercontent.com/example/garden/${commit}/${file.path.split('/').map(encodeURIComponent).join('/')}`,
    )
    if (file) return new Response(file.content ?? 'source\n')
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('GitHub repository input', () => {
  it.each([
    ['example/garden', 'example/garden'],
    [' https://github.com/Example/garden/ ', 'Example/garden'],
    ['github.com/example/garden.git', 'example/garden'],
    ['https://www.github.com/example/garden?tab=readme-ov-file#readme', 'example/garden'],
  ])('normalizes %s', (input, expected) => expect(parseGitHubRepository(input)).toBe(expected))

  it.each([
    '',
    'repo',
    '../repo',
    'example/..',
    'example/garden/tree/main',
    'https://evil.test/example/garden',
    'https://github.com.evil.test/example/garden',
    'https://user:password@github.com/example/garden',
    'https://github.com:444/example/garden',
    'git@github.com:example/garden.git',
    'example/garden?x=1',
  ])('rejects %s before making requests', async (input) => {
    const fetcher = github([])
    await expect(fetchGitHubRepository(input)).rejects.toThrow('GitHub-Repository-URL')
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('GitHub repository import', () => {
  it('imports every eligible file at one commit without downloading contents', async () => {
    const fetcher = github(
      [
        { path: 'src/ui/Button.tsx', content: '// comment\r\n\r\nexport const button = 1\r\n' },
        { path: 'src/city/generate.ts', content: 'one\ntwo\nthree' },
        { path: 'src/city/module #1.ts', content: 'special path\n' },
        { path: 'node_modules/package/main.js' },
        { path: 'src/generated.min.js' },
        { path: 'src/symlink.ts', mode: '120000' },
        { path: '.hidden.ts' },
        { path: 'src/large.ts', size: 20 * 1024 * 1024 },
        { path: 'submodule', mode: '160000', type: 'commit' },
        { path: 'README.md' },
      ],
      { branch: 'release/current' },
    )
    const progress = vi.fn()
    const snapshot = await fetchGitHubRepository('https://github.com/example/garden.git', {
      onProgress: progress,
    })
    expect(snapshot).toMatchObject({
      name: 'example/garden',
      source: 'github',
      sizeMetric: 'bytes',
      url: 'https://github.com/example/garden',
      revision: { branch: 'release/current', commit },
    })
    expect(snapshot.modules.map((module) => module.id)).toEqual([
      'src/city/generate.ts',
      'src/city/module #1.ts',
      'src/large.ts',
      'src/ui/Button.tsx',
    ])
    expect(
      snapshot.modules.every(
        (module) =>
          module.metrics.lines === null && module.metrics.files === 1 && module.metrics.bytes! >= 0,
      ),
    ).toBe(true)
    expect(snapshot.modules[0].metrics.bytes).toBe(13)
    expect(snapshot.districts.map((district) => district.id)).toEqual(['src', 'src/city', 'src/ui'])
    expect(snapshot.notice).toContain('Alle 4 Quelldateien')
    expect(JSON.stringify(snapshot)).not.toContain('export const')
    expect(progress).toHaveBeenLastCalledWith(4, 4)
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const [, options] of fetcher.mock.calls) expect(options?.credentials).toBe('omit')
    expect(await fetchGitHubRepository('example/garden')).toEqual(snapshot)
  })

  it('keeps all 5905 files and their exact directory proportions without file or aggregate byte caps', async () => {
    const files = Array.from({ length: 5905 }, (_, i) => ({
      path: `src/${i < 5000 ? 'core' : 'ui'}/file-${String(i).padStart(4, '0')}.ts`,
      size: 1024 * 1024,
    }))
    const fetcher = github(files)
    const snapshot = await fetchGitHubRepository('example/garden')
    expect(snapshot.modules).toHaveLength(5905)
    expect(snapshot.modules.filter((module) => module.districtId === 'src/core')).toHaveLength(5000)
    expect(snapshot.modules.filter((module) => module.districtId === 'src/ui')).toHaveLength(905)
    expect(snapshot.modules.at(-1)?.id).toBe('src/ui/file-5904.ts')
    expect(snapshot.notice).toContain('Alle 5.905')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('measures only the requested source file, with encoded paths pinned to the commit', async () => {
    const fetcher = github([
      { path: 'src/module #1.ts', content: '// comment\r\n\r\nexport const x = 1\r\n' },
    ])
    const snapshot = await fetchGitHubRepository('example/garden')
    expect(await fetchGitHubFileLines(snapshot, snapshot.modules[0])).toBe(2)
    expect(snapshot.modules[0].metrics.lines).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
      `https://raw.githubusercontent.com/example/garden/${commit}/src/module%20%231.ts`,
    )
    expect(fetcher.mock.calls.at(-1)?.[1]).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  })

  it('retains binary-looking and oversized files as buildings and explains unmeasurable contents', async () => {
    const fetcher = github([
      { path: 'large.ts', size: MAX_MEASUREMENT_BYTES + 1 },
      { path: 'binary.ts', content: 'binary\0content' },
    ])
    const snapshot = await fetchGitHubRepository('example/garden')
    expect(snapshot.modules).toHaveLength(2)
    await expect(
      fetchGitHubFileLines(
        snapshot,
        snapshot.modules.find((module) => module.id === 'large.ts')!,
      ),
    ).rejects.toThrow('8 MiB')
    expect(fetcher).toHaveBeenCalledTimes(3)
    await expect(fetchGitHubFileLines(snapshot, snapshot.modules[0])).rejects.toThrow('Binärdaten')
  })

  it('rejects oversized responses even if tree metadata understates their size', async () => {
    github([{ path: 'file.ts' }])
    const snapshot = await fetchGitHubRepository('example/garden')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('oversized', {
            headers: { 'content-length': String(MAX_MEASUREMENT_BYTES + 1) },
          }),
      ),
    )
    await expect(fetchGitHubFileLines(snapshot, snapshot.modules[0])).rejects.toThrow('Messlimit')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array(MAX_MEASUREMENT_BYTES + 1))),
    )
    await expect(fetchGitHubFileLines(snapshot, snapshot.modules[0])).rejects.toThrow('Messlimit')
  })

  it('cancels pending file measurements and times them out', async () => {
    github([{ path: 'file.ts' }])
    const snapshot = await fetchGitHubRepository('example/garden')
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            })
          }),
      ),
    )
    const controller = new AbortController()
    const cancelled = expect(
      fetchGitHubFileLines(snapshot, snapshot.modules[0], controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await cancelled
    const timedOut = expect(fetchGitHubFileLines(snapshot, snapshot.modules[0])).rejects.toThrow(
      'Messung dauert zu lange',
    )
    await vi.advanceTimersByTimeAsync(30_000)
    await timedOut
  })

  it('rejects truncated trees and repositories without supported source files', async () => {
    const fetcher = github([{ path: 'src/real.ts' }], { truncated: true })
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow('Dateistruktur')
    expect(fetcher).toHaveBeenCalledTimes(3)
    github([{ path: 'README.md' }])
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow(
      'Keine unterstützten Quelldateien',
    )
  })

  it.each([
    [404, 'nicht gefunden'],
    [409, 'leer'],
    [403, 'abgewiesen'],
    [500, 'HTTP 500'],
    [429, 'Anfragelimit'],
  ])('reports HTTP %i without returning invented data', async (status, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status })),
    )
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow(message)
  })

  it('explains the rate limit reset and network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 403,
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(Math.ceil(Date.now() / 1000) + 300),
            },
          }),
      ),
    )
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow(/in etwa [56] Minuten/)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow(
      'Verbindung zu GitHub fehlgeschlagen',
    )
  })

  it('rejects malformed commit metadata', async () => {
    const fetcher = github([{ path: 'src/file.ts' }])
    const original = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, options) =>
      String(url).includes('/branches/')
        ? Response.json({ commit: { sha: '../../other' } })
        : original(url, options),
    )
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow('gültigen Commit')
  })

  it('aborts active downloads and starts no requests for an already cancelled import', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetcher = github([])
    await expect(
      fetchGitHubRepository('example/garden', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).not.toHaveBeenCalled()
    const active = new AbortController()
    github([{ path: 'file.ts' }])
    await expect(
      fetchGitHubRepository('example/garden', {
        signal: active.signal,
        onProgress: () => active.abort(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('times out stalled requests', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            })
          }),
      ),
    )
    const result = expect(fetchGitHubRepository('example/garden')).rejects.toThrow(
      'dauert zu lange',
    )
    await vi.advanceTimersByTimeAsync(120_000)
    await result
  })
})
