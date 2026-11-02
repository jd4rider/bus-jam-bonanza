// Bakes the full 300-level Journey. Every level is built deterministically,
// replayed through the gameplay engine, and rejected if anything fails.
//
// Usage: npm run bake [-- --from 1 --to 30]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCampaignLevel } from '../src/core/campaign'
import { validateLevel } from '../src/core/validate'
import { LEVELS_PER_WORLD, WORLD_COUNT, type LevelDefinition, type LevelManifest } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const args = process.argv.slice(2)
const readArg = (name: string): number | null => {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return null
  const value = Number(args[index + 1])
  return Number.isFinite(value) ? value : null
}

const from = readArg('from')
const to = readArg('to')
const only = from !== null || to !== null

const levels: LevelDefinition[] = []
const started = Date.now()

for (let world = 1; world <= WORLD_COUNT; world += 1) {
  for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
    const global = (world - 1) * LEVELS_PER_WORLD + index + 1
    if (only && ((from !== null && global < from) || (to !== null && global > to))) continue
    const level = buildCampaignLevel(world, index)
    if (!level) {
      throw new Error(`level ${global} could not be generated`)
    }
    const errors = validateLevel(level)
    if (errors.length) {
      throw new Error(`level ${global} failed validation:\n${errors.join('\n')}`)
    }
    levels.push(level)
    process.stdout.write(
      `\u2713 ${String(global).padStart(3, ' ')} w${world} ${level.name.padEnd(22)} buses ${level.buses.length} bays ${level.bays} queue ${level.queue.length} par ${level.par} diff ${level.difficulty}\n`,
    )
  }
}

if (only) {
  console.log(`\nBaked ${levels.length} level(s) but did not overwrite the manifest during a partial run.`)
  process.exit(0)
}

if (levels.length !== LEVELS_PER_WORLD * WORLD_COUNT) {
  throw new Error(`expected 300 levels, built ${levels.length}`)
}

const manifest: LevelManifest = {
  format: 1,
  generator: 'bus-jam-bonanza/bake-v1',
  levels,
}

mkdirSync(resolve(root, 'src/data'), { recursive: true })
writeFileSync(resolve(root, 'src/data/levels.json'), `${JSON.stringify(manifest, null, 1)}\n`)

const seconds = ((Date.now() - started) / 1000).toFixed(1)
const parTotal = levels.reduce((sum, level) => sum + level.par, 0)
const passengers = levels.reduce((sum, level) => sum + level.queue.length, 0)
console.log(`\nBaked ${levels.length} validated levels in ${seconds}s`)
console.log(`Total par ${parTotal} \u00b7 passengers ${passengers} \u00b7 difficulty ${Math.min(...levels.map((l) => l.difficulty))}\u2013${Math.max(...levels.map((l) => l.difficulty))}`)
