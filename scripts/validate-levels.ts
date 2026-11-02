// Re-validates the shipped manifest without regenerating it. This is the same
// check the campaign test runs, available as a standalone command.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateLevel } from '../src/core/validate'
import { replaySolution, solveLevel } from '../src/core/solver'
import { initialState } from '../src/core/engine'
import type { LevelManifest } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'src/data/levels.json'), 'utf8')) as LevelManifest

let errors = 0
const started = Date.now()
for (const [index, level] of manifest.levels.entries()) {
  const problems = validateLevel(level)
  if (problems.length) {
    errors += problems.length
    console.error(problems.join('\n'))
    continue
  }
  const replay = replaySolution(level, level.solution)
  if (!replay.ok) {
    errors += 1
    console.error(`${level.id}: replay failed`)
  }
  if ((index + 1) % 50 === 0) console.log(`checked ${index + 1}/${manifest.levels.length}`)
}

// Independent full solve of a sample, including every tenth level.
const sample = manifest.levels.filter((_, index) => index % 10 === 0)
for (const level of sample) {
  const solved = solveLevel(level, initialState(level), { maxStates: 200_000, maxMillis: 20_000 })
  if (solved.status !== 'solved') {
    errors += 1
    console.error(`${level.id}: solver returned ${solved.status}`)
  } else if (solved.moves.length < level.par) {
    errors += 1
    console.error(`${level.id}: par ${level.par} is above the solver optimum ${solved.moves.length}`)
  }
}

if (manifest.levels.length !== 300) {
  errors += 1
  console.error(`expected 300 levels, found ${manifest.levels.length}`)
}

const seconds = ((Date.now() - started) / 1000).toFixed(2)
if (errors) {
  console.error(`\n${errors} problem(s) in ${seconds}s`)
  process.exit(1)
}
console.log(`\nAll ${manifest.levels.length} levels valid; ${sample.length} sampled solves verified in ${seconds}s.`)
