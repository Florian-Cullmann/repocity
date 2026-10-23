import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGitHubRepository, MAX_GITHUB_FILES, parseGitHubRepository } from './githubRepository'

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
  it('measures real files at one commit, skips excluded paths and reports progress', async () => {
    const fetcher = github(
      [
        { path: 'src/ui/Button.tsx', content: '// comment\r\n\r\nexport const button = 1\r\n' },
        { path: 'src/city/generate.ts', content: 'one\ntwo\nthree' },
        { path: 'src/city/module #1.ts', content: 'special path\n' },
        { path: 'node_modules/package/main.js' },
        { path: 'src/generated.min.js' },
        { path: 'src/symlink.ts', mode: '120000' },
        { path: '.hidden.ts' },
        { path: 'src/large.ts', size: 1024 * 1024 + 1 },
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
      url: 'https://github.com/example/garden',
      revision: { branch: 'release/current', commit },
    })
    expect(snapshot.modules.map((module) => module.id)).toEqual([
      'src/city/generate.ts',
      'src/city/module #1.ts',
      'src/ui/Button.tsx',
    ])
    expect(snapshot.modules.map((module) => module.metrics)).toEqual([
      { lines: 3, files: 1, dependencies: null, coverage: null },
      { lines: 1, files: 1, dependencies: null, coverage: null },
      { lines: 2, files: 1, dependencies: null, coverage: null },
    ])
    expect(snapshot.districts.map((district) => district.id)).toEqual(['src/city', 'src/ui'])
    expect(snapshot.notice).toBeUndefined()
    expect(JSON.stringify(snapshot)).not.toContain('export const')
    expect(progress).toHaveBeenLastCalledWith(3, 3)
    expect(fetcher).toHaveBeenCalledTimes(6)
    for (const [url, options] of fetcher.mock.calls) {
      expect(options?.credentials).toBe('omit')
      if (String(url).startsWith('https://raw.')) expect(String(url)).toContain(`/${commit}/`)
    }
    expect(await fetchGitHubRepository('example/garden')).toEqual(snapshot)
  })

  it('caps large imports and samples multiple areas instead of implying completeness', async () => {
    const files = Array.from({ length: 1000 }, (_, i) => ({
      path: `src/file-${String(i).padStart(4, '0')}.ts`,
    }))
    const fetcher = github(files)
    const snapshot = await fetchGitHubRepository('example/garden')
    expect(snapshot.modules).toHaveLength(MAX_GITHUB_FILES)
    expect(snapshot.modules.at(-1)?.id).toBe('src/file-0998.ts')
    expect(snapshot.notice).toContain('768 von 1000')
    expect(fetcher).toHaveBeenCalledTimes(3 + MAX_GITHUB_FILES)
  })

  it('respects the aggregate download budget and omits binary files', async () => {
    github(Array.from({ length: 40 }, (_, i) => ({ path: `src/file-${i}.ts`, size: 1024 * 1024 })))
    expect((await fetchGitHubRepository('example/garden')).modules).toHaveLength(32)
    github([{ path: 'real.ts' }, { path: 'binary.ts', content: 'binary\0content' }])
    const snapshot = await fetchGitHubRepository('example/garden')
    expect(snapshot.modules.map((module) => module.id)).toEqual(['real.ts'])
    expect(snapshot.notice).toContain('1 von 2')
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

  it('rejects malformed commit metadata and oversized streamed content', async () => {
    const fetcher = github([{ path: 'src/file.ts' }])
    const original = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, options) =>
      String(url).includes('/branches/')
        ? Response.json({ commit: { sha: '../../other' } })
        : original(url, options),
    )
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow('gültigen Commit')
    const large = github([{ path: 'src/file.ts', size: 1, content: 'x'.repeat(1024 * 1024 + 1) }])
    await expect(fetchGitHubRepository('example/garden')).rejects.toThrow('1 MiB')
    expect(large).toHaveBeenCalledTimes(4)
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
