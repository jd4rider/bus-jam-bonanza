import { describe, expect, it } from 'vitest'
import {
  clearSession,
  defaultProgress,
  loadProgress,
  loadSession,
  mergeProgress,
  recordCompletion,
  sanitizeProgress,
  saveProgress,
  saveSession,
  starsFor,
  STORAGE_KEY,
  type SaveStore,
} from '../src/core/saves'

function memoryStore(): SaveStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

describe('saves', () => {
  it('falls back to a clean save for corrupt blobs', () => {
    const store = memoryStore()
    store.setItem(STORAGE_KEY, '{"completed": 12, "unlocked": -4, "settings": null}')
    const progress = loadProgress(store)
    expect(progress.unlocked).toBe(1)
    expect(progress.completed).toEqual({})
    expect(progress.settings.sound).toBe(true)
  })

  it('round-trips a valid save', () => {
    const store = memoryStore()
    const progress = defaultProgress()
    progress.unlocked = 42
    progress.completed['level-001'] = { stars: 3, bestMoves: 3, hints: 0, at: 123 }
    saveProgress(progress, store)
    const loaded = loadProgress(store)
    expect(loaded.unlocked).toBe(42)
    expect(loaded.completed['level-001'].stars).toBe(3)
  })

  it('clamps hostile numbers', () => {
    const progress = sanitizeProgress({
      unlocked: 9999,
      completed: { x: { stars: 99, bestMoves: -4, hints: -1, at: 0 } },
      settings: { speed: 100 },
    })
    expect(progress.unlocked).toBe(300)
    expect(progress.completed.x.stars).toBe(3)
    expect(progress.completed.x.bestMoves).toBe(0)
    expect(progress.settings.speed).toBe(1.6)
  })

  it('merges cloud progress without erasing better local records', () => {
    const local = defaultProgress()
    local.completed['level-001'] = { stars: 3, bestMoves: 3, hints: 0, at: 1 }
    local.unlocked = 20
    local.achievements = ['first_departure']
    const cloud = defaultProgress()
    cloud.completed['level-001'] = { stars: 1, bestMoves: 9, hints: 2, at: 2 }
    cloud.completed['level-002'] = { stars: 2, bestMoves: 5, hints: 1, at: 2 }
    cloud.unlocked = 30
    cloud.achievements = ['daily_driver']
    const merged = mergeProgress(local, cloud)
    expect(merged.completed['level-001']).toMatchObject({ stars: 3, bestMoves: 3 })
    expect(merged.completed['level-002'].stars).toBe(2)
    expect(merged.unlocked).toBe(30)
    expect(merged.achievements.sort()).toEqual(['daily_driver', 'first_departure'])
  })

  it('awards stars for par without help', () => {
    expect(starsFor(5, 5, 0)).toBe(3)
    expect(starsFor(5, 5, 1)).toBe(2)
    expect(starsFor(7, 5, 0)).toBe(2)
    expect(starsFor(9, 5, 0)).toBe(1)
    expect(starsFor(9, 5, 3)).toBe(1)
  })

  it('records a completion, unlocks the next stop and banks a first award', () => {
    const before = defaultProgress()
    before.unlocked = 1
    const result = recordCompletion(before, {
      levelId: 'level-001',
      levelNumber: 1,
      stars: 3,
      moves: 3,
      hints: 0,
      passengers: 14,
    })
    expect(result.progress.completed['level-001']).toMatchObject({ stars: 3, bestMoves: 3 })
    expect(result.progress.unlocked).toBe(2)
    expect(result.progress.stats.passengers).toBe(14)
    expect(result.newAchievements).toContain('first_departure')
    expect(result.newAchievements).toContain('perfect_pickup')
  })

  it('stores and clears an in-progress session', () => {
    const store = memoryStore()
    saveSession(
      {
        version: 1,
        levelId: 'level-004',
        state: { parked: ['b1'], bays: [null, null, null], queueIndex: 2 },
        moves: 1,
        hints: 0,
        mode: 'journey',
        at: Date.now(),
      },
      store,
    )
    const loaded = loadSession(store)
    expect(loaded?.levelId).toBe('level-004')
    expect(loaded?.mode).toBe('journey')
    clearSession(store)
    expect(loadSession(store)).toBeNull()
  })
})
