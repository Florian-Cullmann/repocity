import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyzeRepository } from './analyzeRepository.mjs'
import { generateCity } from '../src/city/generateCity'

describe('local repository analysis', () => {
  let temporary: string
  let root: string

  async function file(path: string, content: string) {
    const destination = join(root, path)
    await mkdir(join(destination, '..'), { recursive: true })
    await writeFile(destination, content)
  }

  beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'repocity-'))
    root = join(temporary, 'fixture')
    await mkdir(root)
  })
  afterEach(async () => {
    await rm(temporary, { recursive: true, force: true })
  })

  it('measures source files and groups nested modules into stable directory districts', async () => {
    await file('src/App.tsx', '// comment\r\n\r\nexport const App = 1\r\n   \r\n')
    await file('src/city/generate.ts', 'export const a = 1\nexport const b = 2')
    await file('src/city/helpers/random.ts', '// helper\n')
    await file('src/ui/styles.css', '.a {\n color: red;\n}\n')
    await file('tests/app.spec.ts', 'test()\n')
    await file('vite.config.ts', 'export default {}\n')
    const snapshot = await analyzeRepository(root)
    expect(snapshot.name).toBe('fixture')
    expect(snapshot.source).toBe('local')
    expect(snapshot.districts.map((district) => district.id)).toEqual([
      '.',
      'src',
      'src/city',
      'src/ui',
      'tests',
    ])
    expect(snapshot.modules).toHaveLength(6)
    expect(snapshot.modules.find((module) => module.id === 'src/App.tsx')).toMatchObject({
      name: 'App.tsx',
      path: 'src/App.tsx',
      language: 'TypeScript',
      districtId: 'src',
      metrics: { lines: 2, files: 1, dependencies: null, coverage: null },
    })
    expect(
      snapshot.modules.find((module) => module.id === 'src/city/generate.ts')?.metrics.lines,
    ).toBe(2)
    expect(
      snapshot.modules.find((module) => module.id === 'src/city/helpers/random.ts')?.districtId,
    ).toBe('src/city')
    expect(snapshot.modules.find((module) => module.id === 'src/ui/styles.css')).toMatchObject({
      language: 'CSS',
      metrics: { lines: 3 },
    })
    expect(snapshot.modules.reduce((sum, module) => sum + (module.metrics.lines ?? 0), 0)).toBe(10)
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain(root)
    expect(serialized).not.toContain('export const')
    expect(generateCity(snapshot, { seed: 'real' }).buildings).toHaveLength(6)
  })

  it('excludes dependencies, generated files, hidden files, binary data and symlinks', async () => {
    await file('src/real.ts', 'export {}\n')
    for (const path of [
      'node_modules/package/index.js',
      'dist/bundle.js',
      'build/generated.ts',
      'coverage/script.js',
      'test-results/report.js',
      'playwright-report/report.js',
      'vendor/lib.php',
      'target/output.rs',
      '.git/config.js',
      '.hidden.ts',
      '.env',
      'package-lock.json',
      'public/photo.png',
      'src/client.min.js',
      'src/types.generated.ts',
    ])
      await file(path, 'excluded')
    await file('src/binary.ts', 'binary\0data')
    await file('src/oversized.ts', 'x'.repeat(1024 * 1024 + 1))
    const outside = join(temporary, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'secret.ts'), 'outside source')
    await symlink(outside, join(root, 'linked-directory'), 'dir')
    await symlink(join(outside, 'secret.ts'), join(root, 'linked.ts'))
    expect((await analyzeRepository(root)).modules.map((module) => module.id)).toEqual([
      'src/real.ts',
    ])
  })

  it('is reproducible and preserves identities and district colors after source edits', async () => {
    await file('src/city/z.ts', 'one\n')
    await file('src/ui/a.ts', 'one\n')
    const first = await analyzeRepository(root)
    await file('README.md', 'Ignored documentation')
    expect(await analyzeRepository(root)).toEqual(first)
    await file('src/city/z.ts', 'line\n'.repeat(240))
    const changed = await analyzeRepository(root)
    expect(changed.districts).toEqual(first.districts)
    expect(changed.modules.map((module) => module.id)).toEqual(
      first.modules.map((module) => module.id),
    )
    const oldBuilding = generateCity(first, { seed: 'same' }).buildings[0]
    const newBuilding = generateCity(changed, { seed: 'same' }).buildings[0]
    expect(newBuilding.id).toBe(oldBuilding.id)
    expect(newBuilding.height).toBeGreaterThan(oldBuilding.height)
    expect(newBuilding.position).toEqual(oldBuilding.position)
  })

  it('reports empty or missing projects instead of inventing modules', async () => {
    await expect(analyzeRepository(root)).rejects.toThrow('Keine unterstützten Quelldateien')
    await expect(analyzeRepository(join(root, 'missing'))).rejects.toThrow('ENOENT')
  })

  it('exports a usable snapshot through the CLI and reports invalid input', async () => {
    await file('src/main.py', 'print("hello")\n')
    const output = join(temporary, 'exports', 'snapshot.json')
    const result = spawnSync(
      process.execPath,
      ['scripts/analyze.mjs', root, '--name', 'My project', '--output', output],
      { encoding: 'utf8' },
    )
    expect(result.status, result.stderr).toBe(0)
    const snapshot = JSON.parse(await readFile(output, 'utf8'))
    expect(snapshot).toMatchObject({ name: 'My project', source: 'local' })
    expect(snapshot.modules[0]).toMatchObject({ path: 'src/main.py', language: 'Python' })
    const invalid = spawnSync(process.execPath, ['scripts/analyze.mjs', root, 'extra'], {
      encoding: 'utf8',
    })
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain('genau ein Projektverzeichnis')
    const missing = spawnSync(process.execPath, ['scripts/analyze.mjs', join(root, 'missing')], {
      encoding: 'utf8',
    })
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('Analyse fehlgeschlagen:')
  })
})
