import type { LevelDefinition } from './types'
import { LEVELS } from './levels'
import { utcDateKey, utcDayNumber, hashString } from './rng'

export type GameMode = 'journey' | 'zen' | 'daily' | 'expert' | 'endless' | 'free'

export interface ModeLabel {
  id: GameMode
  name: string
  blurb: string
}

export const MODES: ModeLabel[] = [
  { id: 'journey', name: 'Journey', blurb: '300 hand-tuned puzzles across ten worlds.' },
  { id: 'zen', name: 'Zen', blurb: 'No pressure. Unlimited undo on any unlocked stop.' },
  { id: 'daily', name: 'Daily', blurb: 'One shared puzzle every UTC day.' },
  { id: 'expert', name: 'Expert', blurb: 'The hardest verified puzzles, par in sight.' },
  { id: 'endless', name: 'Endless', blurb: 'An unbroken run of validated puzzles.' },
  { id: 'free', name: 'Free Play', blurb: 'Replay anything you have already unlocked.' },
]

const DAILY_POOL_START = 240
const DAILY_POOL_END = 300

export function dailyPool(): LevelDefinition[] {
  return LEVELS.slice(DAILY_POOL_START - 1, DAILY_POOL_END)
}

export function dailyChallenge(date: Date = new Date()): { level: LevelDefinition; dateKey: string; index: number } {
  const pool = dailyPool()
  const day = utcDayNumber(date)
  const index = ((day % pool.length) + pool.length) % pool.length
  return { level: pool[index], dateKey: utcDateKey(date), index }
}

export function expertLevel(seed: number): LevelDefinition {
  const pool = LEVELS.filter((level) => level.world >= 7)
  return pool[Math.abs(hashString(`expert:${seed}`)) % pool.length]
}

export function endlessLevel(run: number, step: number): LevelDefinition {
  const pool = LEVELS.filter((level) => level.world >= 3)
  const index = Math.abs(hashString(`endless:${run}:${step}`)) % pool.length
  return pool[index]
}

/** Best par among candidate levels, used by Expert's move target. */
export function parOf(level: LevelDefinition): number {
  return Math.max(1, level.par)
}
