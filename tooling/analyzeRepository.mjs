import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  createSourceRepository,
  isSourceDirectory,
  MAX_SOURCE_BYTES,
  measureSourceFile,
  sourceLanguage,
} from '../src/data/sourceRepository.mjs'

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

  /** @param {string[]} parts */
  async function walk(parts) {
    const entries = await readdir(join(root, ...parts), { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const next = [...parts, entry.name]
      if (entry.isDirectory()) {
        if (isSourceDirectory(next.join('/'))) await walk(next)
        continue
      }
      // Symlinks are deliberately not followed, even when they point to source files.
      if (!entry.isFile()) continue
      const path = next.join('/')
      if (!sourceLanguage(path)) continue
      const absolutePath = join(root, ...next)
      if ((await stat(absolutePath)).size > MAX_SOURCE_BYTES) continue
      const module = measureSourceFile(path, await readFile(absolutePath, 'utf8'))
      if (module) modules.push(module)
    }
  }

  await walk([])
  return createSourceRepository(name, 'local', modules)
}
