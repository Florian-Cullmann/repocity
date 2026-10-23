import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { analyzeRepository } from './analyzeRepository.mjs'

/** Bundle measured metadata at startup/build; source contents stay on the local filesystem. */
export function repositorySnapshot(): Plugin {
  const id = 'virtual:repository-snapshot'
  const resolvedId = `\0${id}`
  let root: string
  return {
    name: 'repocity-repository-snapshot',
    configResolved(config) {
      root = resolve(config.root, process.env.REPOCITY_REPOSITORY || '.')
    },
    resolveId(source) {
      if (source === id) return resolvedId
    },
    async load(source) {
      if (source !== resolvedId) return
      const snapshot = await analyzeRepository(root)
      return `export default ${JSON.stringify(snapshot)}`
    },
  }
}
