import { evaluateAchievements } from './achievements'
import type { EngineState } from './types'
import { TOTAL_LEVELS } from './types'

export interface LevelRecord {
  stars: number
  bestMoves: number
  hints: number
  at: number
}

export interface Settings {
  sound: boolean
  music: boolean
  reducedMotion: boolean
  highContrast: boolean
  /** 0.5 = slow, 1 = normal, 1.6 = fast. */
  speed: number
}

export interface Stats {
  levels: number
  passengers: number
  dispatches: number
  perfect: number
  hints: number
  dailyPlayed: number
}

export interface Progress {
  version: number
  completed: Record<string, LevelRecord>
  achievements: string[]
  settings: Settings
  unlocked: number
  stats: Stats
  daily: Record<string, { stars: number; moves: number }>
  endless: { best: number; runs: number }
}

export interface SaveStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export const SAVE_VERSION = 1
export const STORAGE_KEY = 'bus-jam-bonanza-save-v1'
export const SESSION_KEY = 'bus-jam-bonanza-session-v1'

function memoryStore(): SaveStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

const fallback = memoryStore()

export function defaultStore(): SaveStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__bjb_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      return localStorage
    }
  } catch {
    // Private mode or blocked storage: keep playing with a session store.
  }
  return fallback
}

export function defaultSettings(): Settings {
  return { sound: true, music: true, reducedMotion: false, highContrast: false, speed: 1 }
}

export function defaultProgress(): Progress {
  return {
    version: SAVE_VERSION,
    completed: {},
    achievements: [],
    settings: defaultSettings(),
    unlocked: 1,
    stats: { levels: 0, passengers: 0, dispatches: 0, perfect: 0, hints: 0, dailyPlayed: 0 },
    daily: {},
    endless: { best: 0, runs: 0 },
  }
}

const clampNumber = (value: unknown, min: number, max: number, fallbackValue: number): number => {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallbackValue
  return Math.min(max, Math.max(min, number))
}

const bool = (value: unknown, fallbackValue: boolean): boolean => (typeof value === 'boolean' ? value : fallbackValue)

/** Never trust a stored blob: rebuild a clean Progress from whatever is there. */
export function sanitizeProgress(raw: unknown): Progress {
  const clean = defaultProgress()
  if (!raw || typeof raw !== 'object') return clean
  const value = raw as Record<string, unknown>

  if (value.completed && typeof value.completed === 'object') {
    for (const [id, record] of Object.entries(value.completed as Record<string, unknown>)) {
      if (!record || typeof record !== 'object') continue
      const entry = record as Record<string, unknown>
      clean.completed[id] = {
        stars: Math.round(clampNumber(entry.stars, 0, 3, 0)),
        bestMoves: Math.round(clampNumber(entry.bestMoves, 0, 999, 0)),
        hints: Math.round(clampNumber(entry.hints, 0, 999, 0)),
        at: Math.round(clampNumber(entry.at, 0, Number.MAX_SAFE_INTEGER, 0)),
      }
    }
  }

  if (Array.isArray(value.achievements)) {
    clean.achievements = [...new Set(value.achievements.filter((id): id is string => typeof id === 'string'))]
  }

  if (value.settings && typeof value.settings === 'object') {
    const settings = value.settings as Record<string, unknown>
    clean.settings = {
      sound: bool(settings.sound, true),
      music: bool(settings.music, true),
      reducedMotion: bool(settings.reducedMotion, false),
      highContrast: bool(settings.highContrast, false),
      speed: clampNumber(settings.speed, 0.5, 1.6, 1),
    }
  }

  clean.unlocked = Math.round(clampNumber(value.unlocked, 1, TOTAL_LEVELS, 1))

  if (value.stats && typeof value.stats === 'object') {
    const stats = value.stats as Record<string, unknown>
    clean.stats = {
      levels: Math.round(clampNumber(stats.levels, 0, 1_000_000, 0)),
      passengers: Math.round(clampNumber(stats.passengers, 0, 10_000_000, 0)),
      dispatches: Math.round(clampNumber(stats.dispatches, 0, 10_000_000, 0)),
      perfect: Math.round(clampNumber(stats.perfect, 0, 1_000_000, 0)),
      hints: Math.round(clampNumber(stats.hints, 0, 1_000_000, 0)),
      dailyPlayed: Math.round(clampNumber(stats.dailyPlayed, 0, 1_000_000, 0)),
    }
  }

  if (value.daily && typeof value.daily === 'object') {
    for (const [date, record] of Object.entries(value.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !record || typeof record !== 'object') continue
      const entry = record as Record<string, unknown>
      clean.daily[date] = {
        stars: Math.round(clampNumber(entry.stars, 0, 3, 0)),
        moves: Math.round(clampNumber(entry.moves, 0, 999, 0)),
      }
    }
  }

  if (value.endless && typeof value.endless === 'object') {
    const endless = value.endless as Record<string, unknown>
    clean.endless = {
      best: Math.round(clampNumber(endless.best, 0, 100_000, 0)),
      runs: Math.round(clampNumber(endless.runs, 0, 100_000, 0)),
    }
  }

  return clean
}

export function loadProgress(store: SaveStore = defaultStore()): Progress {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress()
    return sanitizeProgress(JSON.parse(raw))
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(progress: Progress, store: SaveStore = defaultStore()): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // A full quota must never end the session: the in-memory copy still plays.
  }
}

/**
 * Conservative merge for a cloud/local pair: best stars, fewest moves, union of
 * achievements, furthest unlock. A stale cloud copy can never erase progress.
 */
export function mergeProgress(local: Progress, cloud: Progress): Progress {
  const merged = sanitizeProgress(local)
  for (const [id, record] of Object.entries(cloud.completed)) {
    const existing = merged.completed[id]
    if (!existing) {
      merged.completed[id] = { ...record }
      continue
    }
    const stars = Math.max(existing.stars, record.stars)
    const bestMoves =
      existing.bestMoves <= 0 ? record.bestMoves : record.bestMoves <= 0 ? existing.bestMoves : Math.min(existing.bestMoves, record.bestMoves)
    merged.completed[id] = { ...existing, stars, bestMoves, hints: Math.min(existing.hints, record.hints) }
  }
  merged.achievements = [...new Set([...merged.achievements, ...cloud.achievements])]
  merged.unlocked = Math.max(merged.unlocked, cloud.unlocked)
  merged.stats = {
    levels: Math.max(merged.stats.levels, cloud.stats.levels),
    passengers: Math.max(merged.stats.passengers, cloud.stats.passengers),
    dispatches: Math.max(merged.stats.dispatches, cloud.stats.dispatches),
    perfect: Math.max(merged.stats.perfect, cloud.stats.perfect),
    hints: Math.max(merged.stats.hints, cloud.stats.hints),
    dailyPlayed: Math.max(merged.stats.dailyPlayed, cloud.stats.dailyPlayed),
  }
  merged.daily = { ...cloud.daily, ...merged.daily }
  merged.endless = {
    best: Math.max(merged.endless.best, cloud.endless.best),
    runs: Math.max(merged.endless.runs, cloud.endless.runs),
  }
  return merged
}

export function starsFor(moves: number, par: number, hints: number): number {
  if (hints === 0 && moves <= par) return 3
  if (hints <= 2 && moves <= par + 2) return 2
  return 1
}

export interface CompletionInput {
  levelId: string
  levelNumber: number
  stars: number
  moves: number
  hints: number
  passengers: number
  dailyKey?: string
}

export interface CompletionResult {
  progress: Progress
  newAchievements: string[]
  bestMoves: number
  improved: boolean
}

export function recordCompletion(progress: Progress, input: CompletionInput): CompletionResult {
  const next = sanitizeProgress(progress)
  const existing = next.completed[input.levelId]
  const bestMoves = existing && existing.bestMoves > 0 ? Math.min(existing.bestMoves, input.moves) : input.moves
  const improved = !existing || input.stars > existing.stars || input.moves < (existing.bestMoves || Infinity)
  next.completed[input.levelId] = {
    stars: Math.max(existing?.stars ?? 0, input.stars),
    bestMoves,
    hints: existing ? Math.min(existing.hints, input.hints) : input.hints,
    at: Date.now(),
  }
  next.unlocked = Math.max(next.unlocked, Math.min(TOTAL_LEVELS, input.levelNumber + 1))
  next.stats.levels = Object.keys(next.completed).length
  next.stats.passengers += input.passengers
  next.stats.dispatches += input.moves
  next.stats.hints += input.hints
  if (input.hints === 0) next.stats.perfect += 1
  if (input.dailyKey) {
    const previous = next.daily[input.dailyKey]
    const stars = Math.max(previous?.stars ?? 0, input.stars)
    const moves = previous ? Math.min(previous.moves || input.moves, input.moves) : input.moves
    next.daily[input.dailyKey] = { stars, moves }
    next.stats.dailyPlayed += 1
  }
  const newAchievements = evaluateAchievements(next)
  saveProgress(next)
  return { progress: next, newAchievements, bestMoves, improved }
}

export function recordEndless(progress: Progress, cleared: number): Progress {
  const next = sanitizeProgress(progress)
  next.endless.best = Math.max(next.endless.best, cleared)
  next.endless.runs += 1
  saveProgress(next)
  return next
}

export function updateSettings(progress: Progress, patch: Partial<Settings>): Progress {
  const next = sanitizeProgress(progress)
  next.settings = { ...next.settings, ...patch }
  saveProgress(next)
  return next
}

export interface SavedSession {
  version: number
  levelId: string
  state: EngineState
  moves: number
  hints: number
  mode?: 'journey' | 'zen' | 'daily' | 'expert' | 'endless' | 'free'
  dailyKey?: string
  run?: number
  step?: number
  at: number
}

export function saveSession(session: SavedSession, store: SaveStore = defaultStore()): void {
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function loadSession(store: SaveStore = defaultStore()): SavedSession | null {
  try {
    const raw = store.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as SavedSession
    if (!value || value.version !== SAVE_VERSION || typeof value.levelId !== 'string') return null
    if (!value.state || !Array.isArray(value.state.parked) || !Array.isArray(value.state.bays)) return null
    if (!Number.isInteger(value.state.queueIndex) || value.state.queueIndex < 0) return null
    return value
  } catch {
    return null
  }
}

export function clearSession(store: SaveStore = defaultStore()): void {
  try {
    store.removeItem?.(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.completed).reduce((sum, record) => sum + record.stars, 0)
}
