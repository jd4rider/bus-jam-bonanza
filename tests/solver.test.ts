import { describe, expect, it } from 'vitest'
import { dispatchBus, initialState, isVictory } from '../src/core/engine'
import { replaySolution, solveLevel } from '../src/core/solver'
import { levelByNumber } from '../src/core/levels'
import { bus, makeLevel } from './helpers'

describe('solver', () => {
  it('solves a known campaign level and replays the exact sequence', () => {
    const level = levelByNumber(1)!
    const solved = solveLevel(level, initialState(level), { maxStates: 200_000 })
    expect(solved.status).toBe('solved')
    expect(solved.moves.length).toBeGreaterThan(0)
    expect(solved.moves.length).toBe(level.par)
    const replay = replaySolution(level, solved.moves)
    expect(replay.ok).toBe(true)
    expect(isVictory(level, replay.state)).toBe(true)
  })

  it('proves a hand-built dead end unsolvable', () => {
    const level = makeLevel({
      width: 5,
      height: 2,
      bays: 1,
      buses: [bus('b1', 'blue', 4, 0, 0), bus('b2', 'red', 4, 2, 0)],
      queue: ['blue', 'blue', 'blue', 'blue'],
    })
    const solved = solveLevel(level, initialState(level))
    expect(solved.status).toBe('unsolvable')
    expect(solved.moves).toEqual([])
  })

  it('reports UNKNOWN when the search budget runs out', () => {
    const level = levelByNumber(1)!
    const solved = solveLevel(level, initialState(level), { maxStates: 1 })
    expect(solved.status).toBe('unknown')
    expect(solved.reason).toBe('budget')
  })

  it('rejects an illegal replay instead of guessing', () => {
    const level = levelByNumber(1)!
    const replay = replaySolution(level, ['b999'])
    expect(replay.ok).toBe(false)
    expect(replay.failure).toContain('illegal move')
  })

  it('solves from a mid-level state after an undo-style rewind', () => {
    const level = levelByNumber(3)!
    const first = level.solution[0]
    const start = initialState(level)
    const moved = dispatchBus(level, start, first).state
    const solved = solveLevel(level, moved, { maxStates: 200_000 })
    expect(solved.status).toBe('solved')
    expect(solved.moves.length).toBe(level.par - 1)
  })
})
