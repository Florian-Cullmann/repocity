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
    console.log('Aufruf: npm run analyze -- [Verzeichnis] [--name Name] [--output snapshot.json]')
  } else {
    if (positionals.length > 1) throw new Error('Bitte genau ein Projektverzeichnis angeben.')
    const snapshot = await analyzeRepository(resolve(positionals[0] || '.'), { name: values.name })
    const json = `${JSON.stringify(snapshot, null, 2)}\n`
    if (values.output) {
      const destination = resolve(values.output)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, json)
      console.log(
        `${snapshot.name}: ${snapshot.modules.length} Gebäude, ${snapshot.districts.length} Viertel → ${values.output}`,
      )
    } else {
      process.stdout.write(json)
    }
  }
} catch (error) {
  console.error(`Analyse fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
