import manifestData from '../data/levels.json'
import { LEVELS_PER_WORLD, TOTAL_LEVELS, type LevelDefinition, type LevelManifest } from './types'

const manifest = manifestData as unknown as LevelManifest

export const LEVELS: LevelDefinition[] = manifest.levels

const byId = new Map(LEVELS.map((level) => [level.id, level]))

export function levelById(id: string): LevelDefinition | undefined {
  return byId.get(id)
}

export function levelByNumber(global: number): LevelDefinition | undefined {
  return LEVELS[global - 1]
}

export function levelsOfWorld(world: number): LevelDefinition[] {
  return LEVELS.filter((level) => level.world === world)
}

export function globalNumberOf(level: LevelDefinition): number {
  return (level.world - 1) * LEVELS_PER_WORLD + level.index + 1
}

export function isValidLevelNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= TOTAL_LEVELS
}

/** Hardest validated levels, used by Expert, Daily and Endless. */
export function expertPool(): LevelDefinition[] {
  return LEVELS.filter((level) => level.world >= 6).slice().sort((a, b) => b.difficulty - a.difficulty)
}

export const MANIFEST_META = {
  format: manifest.format,
  generator: manifest.generator,
  count: LEVELS.length,
}
