import { describe, expect, it } from 'vitest'
import {
  analyseState,
  busCells,
  canDispatch,
  cloneState,
  departureCount,
  dispatchBus,
  initialState,
  isVictory,
  remainingPassengers,
  routeReport,
  stateKey,
} from '../src/core/engine'
import type { EngineState } from '../src/core/types'
import { bus, makeLevel } from './helpers'

describe('footprints and routes', () => {
  const level = makeLevel({
    width: 5,
    height: 3,
    bays: 2,
    buses: [bus('b1', 'blue', 4, 1, 1), bus('b2', 'red', 4, 3, 1)],
    queue: ['red', 'red', 'red', 'red'],
  })

  it('expands a bus along its direction', () => {
    expect(busCells(level.buses[1])).toEqual([
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
  })

  it('reports the bus that blocks the lane, not just the destination cell', () => {
    const report = routeReport(level, initialState(level), 'b1')
    expect(report.clear).toBe(false)
    expect(report.blocker).toMatchObject({ kind: 'bus', busId: 'b2' })
    expect(canDispatch(level, initialState(level), 'b1')).toBe(false)
  })

  it('lets the front bus leave and boards matching passengers', () => {
    const start = initialState(level)
    const result = dispatchBus(level, start, 'b2')
    expect(result.ok).toBe(true)
    expect(result.boarding).toHaveLength(4)
    expect(result.departed).toEqual(['b2'])
    expect(result.state.queueIndex).toBe(4)
    expect(result.state.bays.every((slot) => slot === null)).toBe(true)
    expect(isVictory(level, result.state)).toBe(true)
    expect(routeReport(level, result.state, 'b1').clear).toBe(true)
  })
})

describe('boarding bays', () => {
  const level = makeLevel({
    width: 5,
    height: 3,
    bays: 1,
    buses: [bus('b1', 'red', 4, 0, 0), bus('b2', 'blue', 4, 0, 2)],
    queue: ['red', 'red', 'blue', 'blue'],
  })

  it('refuses a second bus when the single bay is occupied', () => {
    const first = dispatchBus(level, initialState(level), 'b1')
    expect(first.ok).toBe(true)
    expect(first.state.bays[0]).toEqual({ busId: 'b1', filled: 2 })
    const second = dispatchBus(level, first.state, 'b2')
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('no-bay')
    expect(second.state).toEqual(first.state)
  })

  it('reports a true deadlock only when nothing can change', () => {
    const first = dispatchBus(level, initialState(level), 'b1')
    const analysis = analyseState(level, first.state)
    expect(analysis.deadlocked).toBe(true)
    expect(analysis.reason).toBe('bays-full')
  })

  it('keeps strict front-of-queue order', () => {
    const strict = makeLevel({
      width: 5,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'red', 4, 0, 0)],
      queue: ['blue', 'red', 'red', 'red'],
    })
    const result = dispatchBus(strict, initialState(strict), 'b1')
    expect(result.ok).toBe(true)
    expect(result.boarding).toHaveLength(0)
    expect(result.state.queueIndex).toBe(0)
    expect(analyseState(strict, result.state).deadlocked).toBe(true)
  })

  it('feeds the lowest-numbered matching bay first', () => {
    const level = makeLevel({
      width: 6,
      height: 3,
      bays: 3,
      buses: [bus('b1', 'red', 4, 0, 0), bus('b2', 'red', 4, 0, 1), bus('b3', 'yellow', 4, 0, 2)],
      queue: ['red', 'red'],
    })
    // A mid-level state: two red buses already in bays, one seat left in bay 0.
    const crafted: EngineState = {
      parked: ['b3'],
      bays: [{ busId: 'b1', filled: 3 }, { busId: 'b2', filled: 0 }, null],
      queueIndex: 0,
    }
    const result = dispatchBus(level, crafted, 'b3')
    expect(result.ok).toBe(true)
    expect(result.boarding.map((step) => step.bayIndex)).toEqual([0, 1])
    expect(result.boarding[0].departed).toBe(true)
    expect(result.state.bays[0]).toBeNull()
    expect(result.state.bays[1]).toEqual({ busId: 'b2', filled: 1 })
  })

  it('leaves an unfillable bus stranded without claiming victory', () => {
    const stranded = makeLevel({
      width: 5,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'red', 4, 0, 0)],
      queue: ['red', 'red'],
    })
    const result = dispatchBus(stranded, initialState(stranded), 'b1')
    expect(result.state.queueIndex).toBe(2)
    expect(isVictory(stranded, result.state)).toBe(false)
    expect(analyseState(stranded, result.state).deadlocked).toBe(true)
    expect(remainingPassengers(stranded, result.state)).toBe(0)
  })
})

describe('traffic gates and obstacles', () => {
  it('opens a gate only after enough departures', () => {
    const level = makeLevel({
      width: 6,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'blue', 4, 0, 1), bus('b2', 'red', 4, 0, 0)],
      queue: ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue'],
      barriers: [{ x: 3, y: 1, opensAfter: 1 }],
    })
    const start = initialState(level)
    expect(routeReport(level, start, 'b1').blocker?.kind).toBe('barrier')
    const red = dispatchBus(level, start, 'b2')
    expect(red.ok).toBe(true)
    expect(departureCount(level, red.state)).toBe(1)
    expect(routeReport(level, red.state, 'b1').clear).toBe(true)
  })

  it('never opens for solid obstacles', () => {
    const level = makeLevel({
      width: 6,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'blue', 4, 0, 1)],
      queue: ['blue'],
      obstacles: [{ x: 3, y: 1 }],
    })
    const report = routeReport(level, initialState(level), 'b1')
    expect(report.clear).toBe(false)
    expect(report.blocker?.kind).toBe('obstacle')
  })
})

describe('state bookkeeping', () => {
  it('clones deeply enough for undo snapshots', () => {
    const level = makeLevel({
      width: 5,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'red', 4, 0, 0)],
      queue: ['red'],
    })
    const start = initialState(level)
    const copy = cloneState(start)
    const result = dispatchBus(level, start, 'b1')
    expect(copy.bays.every((slot) => slot === null)).toBe(true)
    expect(result.state.bays[0]).not.toBeNull()
    expect(start.parked).toEqual(['b1'])
  })

  it('serialises the same state to the same key', () => {
    const level = makeLevel({
      width: 5,
      height: 3,
      bays: 2,
      buses: [bus('b1', 'red', 4, 0, 0), bus('b2', 'blue', 4, 0, 2)],
      queue: ['red', 'blue'],
    })
    const start = initialState(level)
    expect(stateKey(level, start)).toBe(stateKey(level, cloneState(start)))
    const moved = dispatchBus(level, start, 'b1').state
    expect(stateKey(level, moved)).not.toBe(stateKey(level, start))
  })
})
