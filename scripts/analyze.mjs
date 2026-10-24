import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { analyzeRepository } from '../tooling/analyzeRepository.mjs'

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string' },
      name: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log('Usage: npm run analyze -- [directory] [--name name] [--output snapshot.json]')
  } else {
    if (positionals.length > 1) throw new Error('Please specify exactly one project directory.')
    const snapshot = await analyzeRepository(resolve(positionals[0] || '.'), { name: values.name })
    const json = `${JSON.stringify(snapshot, null, 2)}\n`
    if (values.output) {
      const destination = resolve(values.output)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, json)
      console.log(
        `${snapshot.name}: ${snapshot.modules.length} Buildings, ${snapshot.districts.length} Districts → ${values.output}`,
      )
    } else {
      process.stdout.write(json)
    }
  }
} catch (error) {
  console.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
