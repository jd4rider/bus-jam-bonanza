import { describe, expect, it } from 'vitest'
import { LEVELS } from '../src/core/levels'
import { validateLevel } from '../src/core/validate'
import { replaySolution, solveLevel } from '../src/core/solver'
import { initialState } from '../src/core/engine'
import { LEVELS_PER_WORLD, WORLD_COUNT } from '../src/core/types'

describe('the shipped campaign', () => {
  it('contains 300 levels in ten worlds of thirty', () => {
    expect(LEVELS).toHaveLength(300)
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      expect(LEVELS.filter((level) => level.world === world)).toHaveLength(LEVELS_PER_WORLD)
    }
  })

  it('has unique ids and names within each world', () => {
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(300)
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      const names = LEVELS.filter((level) => level.world === world).map((level) => level.name)
      expect(new Set(names).size).toBe(LEVELS_PER_WORLD)
    }
  })

  it('passes schema, geometry, capacity and victory validation for every level', () => {
    const errors = LEVELS.flatMap((level) => validateLevel(level))
    expect(errors).toEqual([])
  })

  it('replays every recorded solution through the gameplay engine', () => {
    const failures = LEVELS.map((level) => {
      const replay = replaySolution(level, level.solution)
      return replay.ok ? null : `${level.id}: ${replay.failure}`
    }).filter((value): value is string => value !== null)
    expect(failures).toEqual([])
  })

  it('has at least one verified solution and a truthful par for a broad sample', () => {
    const sample = LEVELS.filter((_, index) => index % 15 === 0)
    for (const level of sample) {
      const solved = solveLevel(level, initialState(level), { maxStates: 250_000, maxMillis: 20_000 })
      expect(solved.status, level.id).toBe('solved')
      expect(solved.moves.length, level.id).toBe(level.par)
    }
  })

  it('does not start any level already solved', () => {
    for (const level of LEVELS) {
      const start = initialState(level)
      expect(start.queueIndex).toBe(0)
      expect(level.queue.length).toBeGreaterThan(0)
    }
  })

  it('keeps a progressive difficulty trend from world 1 to world 10', () => {
    const early = LEVELS.filter((level) => level.world <= 2)
    const late = LEVELS.filter((level) => level.world >= 9)
    const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(average(late.map((level) => level.difficulty))).toBeGreaterThan(average(early.map((level) => level.difficulty)))
    expect(average(late.map((level) => level.buses.length))).toBeGreaterThan(average(early.map((level) => level.buses.length)))
  })

  it('includes surplus-bus levels and traffic-gate levels', () => {
    const surplus = LEVELS.filter((level) => level.par < level.buses.length)
    const gates = LEVELS.filter((level) => level.barriers.length > 0)
    expect(surplus.length).toBeGreaterThan(10)
    expect(gates.length).toBeGreaterThan(10)
  })

  it('never lets a level rely on an unverified or missing seed', () => {
    for (const level of LEVELS) {
      expect(level.seed).toMatch(/\d+:\d+/)
      expect(level.version).toBe(1)
      expect(level.explored).toBeGreaterThan(0)
    }
  })
})
