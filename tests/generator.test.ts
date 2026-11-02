import { describe, expect, it } from 'vitest'
import { buildCampaignLevel } from '../src/core/campaign'
import { busCells, initialState } from '../src/core/engine'
import { replaySolution } from '../src/core/solver'
import { cellKey, LEVELS_PER_WORLD, WORLD_COUNT } from '../src/core/types'

describe('generator', () => {
  it('is deterministic for a seed', () => {
    const first = buildCampaignLevel(3, 7)
    const second = buildCampaignLevel(3, 7)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('builds the first twenty levels without illegal overlaps', () => {
    for (let index = 0; index < 20; index += 1) {
      const level = buildCampaignLevel(1, index)
      expect(level, `level ${index + 1}`).not.toBeNull()
      const used = new Set<string>()
      for (const bus of level!.buses) {
        for (const cell of busCells(bus)) {
          const key = cellKey(cell.x, cell.y)
          expect(used.has(key), `overlap at ${key}`).toBe(false)
          used.add(key)
          expect(cell.x).toBeGreaterThanOrEqual(0)
          expect(cell.y).toBeGreaterThanOrEqual(0)
          expect(cell.x).toBeLessThan(level!.width)
          expect(cell.y).toBeLessThan(level!.height)
        }
      }
    }
  })

  it('produces a replayable solution for generated levels in later worlds', () => {
    for (let world = 5; world <= WORLD_COUNT; world += 1) {
      for (let index = 0; index < 3; index += 1) {
        const level = buildCampaignLevel(world, index)
        expect(level, `world ${world} level ${index}`).not.toBeNull()
        const replay = replaySolution(level!, level!.solution)
        expect(replay.ok, replay.failure).toBe(true)
        expect(level!.solution.length).toBe(level!.par)
        expect(level!.queue.length).toBeGreaterThan(0)
      }
    }
  })

  it('makes each of the first ten stops a different board', () => {
    const signatures = new Set(
      Array.from({ length: 10 }, (_, index) => {
        const level = buildCampaignLevel(1, index)!
        return JSON.stringify({
          buses: level.buses.map((bus) => [bus.position.x, bus.position.y, bus.direction, bus.length, bus.color]),
          queue: level.queue,
        })
      }),
    )
    expect(signatures.size).toBeGreaterThan(6)
  })

  it('keeps the queue and the used fleet in exact seat balance', () => {
    const level = buildCampaignLevel(8, 12)!
    const used = new Set(level.solution)
    const seats = level.buses
      .filter((bus) => used.has(bus.id))
      .reduce((sum, bus) => sum + bus.capacity, 0)
    expect(seats).toBe(level.queue.length)
    const start = initialState(level)
    expect(start.queueIndex).toBe(0)
  })

  it('uses every capacity class across the campaign', () => {
    const capacities = new Set<number>()
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      const level = buildCampaignLevel(world, 0)!
      level.buses.forEach((bus) => capacities.add(bus.capacity))
    }
    expect([...capacities].sort((a, b) => a - b)).toEqual([4, 6, 8, 12])
  })

  it('has one id per world slot', () => {
    const ids = new Set<string>()
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
        const level = buildCampaignLevel(world, index)!
        ids.add(level.id)
      }
    }
    expect(ids.size).toBe(LEVELS_PER_WORLD * WORLD_COUNT)
  })
})
