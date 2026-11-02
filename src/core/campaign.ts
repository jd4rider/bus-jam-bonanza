import { generateLevel, specFor } from './generator'
import { LEVELS_PER_WORLD, WORLD_COUNT, type LevelDefinition } from './types'
import { levelName } from './worlds'

export interface CampaignBuild {
  level: LevelDefinition
  global: number
}

/** Deterministically builds one campaign level. */
export function buildCampaignLevel(world: number, index: number): LevelDefinition | null {
  const global = (world - 1) * LEVELS_PER_WORLD + index + 1
  const spec = specFor(world, index, levelName(world, index))
  spec.id = `level-${String(global).padStart(3, '0')}`
  return generateLevel(spec)
}

export function allSpecs(): Array<{ world: number; index: number; name: string; id: string }> {
  const output: Array<{ world: number; index: number; name: string; id: string }> = []
  for (let world = 1; world <= WORLD_COUNT; world += 1) {
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const global = (world - 1) * LEVELS_PER_WORLD + index + 1
      output.push({ world, index, name: levelName(world, index), id: `level-${String(global).padStart(3, '0')}` })
    }
  }
  return output
}
