import {
  cellKey,
  DIR_VECTORS,
  type BaySlot,
  type BoardingStep,
  type BusColor,
  type BusDefinition,
  type Blocker,
  type DispatchResult,
  type EngineState,
  type GridPoint,
  type LevelDefinition,
  type RouteReport,
  type StateAnalysis,
} from './types'

interface LevelIndex {
  cells: Map<string, GridPoint[]>
  owners: Map<string, string>
  barriers: Map<string, number>
  obstacles: Set<string>
}

const indexes = new WeakMap<LevelDefinition, LevelIndex>()

function indexOf(level: LevelDefinition): LevelIndex {
  let index = indexes.get(level)
  if (index) return index
  const cells = new Map<string, GridPoint[]>()
  const owners = new Map<string, string>()
  for (const bus of level.buses) {
    const footprint = busCells(bus)
    cells.set(bus.id, footprint)
    for (const point of footprint) owners.set(cellKey(point.x, point.y), bus.id)
  }
  const barriers = new Map<string, number>()
  for (const barrier of level.barriers) barriers.set(cellKey(barrier.x, barrier.y), barrier.opensAfter)
  const obstacles = new Set(level.obstacles.map((point) => cellKey(point.x, point.y)))
  index = { cells, owners, barriers, obstacles }
  indexes.set(level, index)
  return index
}

export function busCells(bus: BusDefinition): GridPoint[] {
  const vector = DIR_VECTORS[bus.direction]
  return Array.from({ length: bus.length }, (_, step) => ({
    x: bus.position.x + vector.x * step,
    y: bus.position.y + vector.y * step,
  }))
}

export function footprintOf(level: LevelDefinition, busId: string): GridPoint[] {
  return indexOf(level).cells.get(busId) ?? []
}

export function headOf(level: LevelDefinition, busId: string): GridPoint {
  const cells = footprintOf(level, busId)
  return cells[cells.length - 1] ?? { x: 0, y: 0 }
}

export function busById(level: LevelDefinition, busId: string): BusDefinition | undefined {
  return level.buses.find((bus) => bus.id === busId)
}

export function initialState(level: LevelDefinition): EngineState {
  return {
    parked: level.buses.map((bus) => bus.id),
    bays: Array.from({ length: level.bays }, () => null as BaySlot),
    queueIndex: 0,
  }
}

export function cloneState(state: EngineState): EngineState {
  return {
    parked: state.parked.slice(),
    bays: state.bays.map((slot) => (slot ? { ...slot } : null)),
    queueIndex: state.queueIndex,
  }
}

export function occupiedBays(state: EngineState): number {
  return state.bays.reduce((count, slot) => (slot ? count + 1 : count), 0)
}

export function dispatchedCount(level: LevelDefinition, state: EngineState): number {
  return level.buses.length - state.parked.length
}

/** Buses that have left a bay for good; drives traffic gates. */
export function departureCount(level: LevelDefinition, state: EngineState): number {
  return dispatchedCount(level, state) - occupiedBays(state)
}

export function firstFreeBay(state: EngineState): number {
  return state.bays.findIndex((slot) => slot === null)
}

function gateIsOpen(level: LevelDefinition, state: EngineState, opensAfter: number): boolean {
  return departureCount(level, state) >= opensAfter
}

/**
 * The straight route a bus takes to the edge of the lot. A bus can only be
 * dispatched when every one of these cells is clear, which is what makes
 * nose-to-tail parking into a puzzle.
 */
export function routeReport(level: LevelDefinition, state: EngineState, busId: string): RouteReport {
  const index = indexOf(level)
  const bus = busById(level, busId)
  if (!bus) return { cells: [], clear: false, blocker: { kind: 'obstacle', x: 0, y: 0 } }
  const vector = DIR_VECTORS[bus.direction]
  const head = headOf(level, busId)
  const parked = new Set(state.parked)
  const cells: GridPoint[] = []
  for (let step = 1; ; step += 1) {
    const point = { x: head.x + vector.x * step, y: head.y + vector.y * step }
    if (point.x < 0 || point.y < 0 || point.x >= level.width || point.y >= level.height) {
      return { cells, clear: true }
    }
    const key = cellKey(point.x, point.y)
    cells.push(point)
    if (index.obstacles.has(key)) {
      return { cells, clear: false, blocker: { kind: 'obstacle', x: point.x, y: point.y } }
    }
    const opensAfter = index.barriers.get(key)
    if (opensAfter !== undefined && !gateIsOpen(level, state, opensAfter)) {
      return { cells, clear: false, blocker: { kind: 'barrier', x: point.x, y: point.y } }
    }
    const owner = index.owners.get(key)
    if (owner && owner !== busId && parked.has(owner)) {
      return { cells, clear: false, blocker: { kind: 'bus', x: point.x, y: point.y, busId: owner } }
    }
  }
}

/** True when a bus may be dispatched right now. */
export function canDispatch(level: LevelDefinition, state: EngineState, busId: string): boolean {
  if (!state.parked.includes(busId)) return false
  if (firstFreeBay(state) < 0) return false
  return routeReport(level, state, busId).clear
}

export function colorOf(level: LevelDefinition, busId: string): BusColor {
  return busById(level, busId)?.color ?? 'red'
}

export function capacityOf(level: LevelDefinition, busId: string): number {
  return busById(level, busId)?.capacity ?? 0
}

function autoBoard(level: LevelDefinition, state: EngineState): { boarding: BoardingStep[]; departed: string[] } {
  const boarding: BoardingStep[] = []
  const departed: string[] = []
  for (;;) {
    const color = level.queue[state.queueIndex]
    if (color === undefined) break
    // Deterministic priority: the lowest-numbered bay with a matching colour
    // and a free seat gets the passenger.
    const bayIndex = state.bays.findIndex(
      (slot) => slot !== null && colorOf(level, slot.busId) === color && slot.filled < capacityOf(level, slot.busId),
    )
    if (bayIndex < 0) break
    const slot = state.bays[bayIndex]
    if (!slot) break
    const capacity = capacityOf(level, slot.busId)
    slot.filled += 1
    state.queueIndex += 1
    const full = slot.filled >= capacity
    boarding.push({
      busId: slot.busId,
      bayIndex,
      color,
      filled: slot.filled,
      capacity,
      departed: full,
      passenger: state.queueIndex - 1,
    })
    if (full) {
      state.bays[bayIndex] = null
      departed.push(slot.busId)
    }
  }
  return { boarding, departed }
}

/**
 * Applies a dispatch in one deterministic step. The returned state is final:
 * movement and boarding animations only visualise it.
 */
export function dispatchBus(level: LevelDefinition, state: EngineState, busId: string): DispatchResult {
  if (!state.parked.includes(busId)) {
    return { ok: false, reason: 'not-parked', state, bayIndex: -1, route: [], boarding: [], departed: [] }
  }
  const bayIndex = firstFreeBay(state)
  if (bayIndex < 0) {
    return { ok: false, reason: 'no-bay', state, bayIndex: -1, route: [], boarding: [], departed: [] }
  }
  const report = routeReport(level, state, busId)
  if (!report.clear) {
    return {
      ok: false,
      reason: 'blocked',
      blocker: report.blocker,
      state,
      bayIndex: -1,
      route: report.cells,
      boarding: [],
      departed: [],
    }
  }

  const next = cloneState(state)
  next.parked = next.parked.filter((id) => id !== busId)
  next.bays[bayIndex] = { busId, filled: 0 }
  const { boarding, departed } = autoBoard(level, next)
  return { ok: true, state: next, bayIndex, route: report.cells, boarding, departed }
}

export function isVictory(level: LevelDefinition, state: EngineState): boolean {
  return state.queueIndex >= level.queue.length && state.bays.every((slot) => slot === null)
}

export function remainingPassengers(level: LevelDefinition, state: EngineState): number {
  return Math.max(0, level.queue.length - state.queueIndex)
}

export function remainingByColor(level: LevelDefinition, state: EngineState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (let index = state.queueIndex; index < level.queue.length; index += 1) {
    const color = level.queue[index]
    counts[color] = (counts[color] ?? 0) + 1
  }
  return counts
}

/** A quick, sound necessary-condition check used by the solver to prune. */
export function isObviouslyStuck(level: LevelDefinition, state: EngineState): boolean {
  const remaining = remainingByColor(level, state)
  for (const slot of state.bays) {
    if (!slot) continue
    const wanted = capacityOf(level, slot.busId) - slot.filled
    if (wanted <= 0) continue
    if ((remaining[colorOf(level, slot.busId)] ?? 0) < wanted) return true
  }
  return false
}

/**
 * Explains the board. Boarding is automatic, so a state is only deadlocked
 * when the queue still has someone and no dispatch can change anything.
 */
export function analyseState(level: LevelDefinition, state: EngineState): StateAnalysis {
  const blocked: Record<string, Blocker> = {}
  const dispatchable: string[] = []
  for (const busId of state.parked) {
    const bayIndex = firstFreeBay(state)
    const report = routeReport(level, state, busId)
    if (bayIndex < 0) {
      blocked[busId] = { kind: 'barrier', x: -1, y: -1 }
      continue
    }
    if (report.clear) dispatchable.push(busId)
    else if (report.blocker) blocked[busId] = report.blocker
  }

  if (isVictory(level, state)) {
    return { victory: true, deadlocked: false, dispatchable, blocked, reason: 'solved' }
  }

  if (state.queueIndex >= level.queue.length) {
    return { victory: false, deadlocked: true, dispatchable, blocked, reason: 'stranded' }
  }

  const front = level.queue[state.queueIndex]
  const canBoardNow = state.bays.some(
    (slot) => slot !== null && colorOf(level, slot.busId) === front && slot.filled < capacityOf(level, slot.busId),
  )
  const baysFull = firstFreeBay(state) < 0
  const deadlocked = !canBoardNow && dispatchable.length === 0
  const reason: StateAnalysis['reason'] = deadlocked ? (baysFull ? 'bays-full' : 'blocked') : 'solved'

  return { victory: false, deadlocked, dispatchable, blocked, reason }
}

/** Compact identity for the search. Order-stable, so hashing is trivial. */
export function stateKey(level: LevelDefinition, state: EngineState): string {
  const parked = new Set(state.parked)
  let mask = 0
  for (let index = 0; index < level.buses.length; index += 1) {
    if (parked.has(level.buses[index].id)) mask |= 1 << index
  }
  const bays = state.bays.map((slot) => (slot ? `${slot.busId}:${slot.filled}` : '-')).join('.')
  return `${mask}|${state.queueIndex}|${bays}`
}

export function describeBlocker(level: LevelDefinition, blocker: Blocker | undefined): string {
  if (!blocker) return 'The way out is blocked.'
  if (blocker.kind === 'bus') {
    const bus = blocker.busId ? busById(level, blocker.busId) : undefined
    return bus ? `Bus ${busNumber(level, bus.id)} is parked in the way.` : 'Another bus is parked in the way.'
  }
  if (blocker.kind === 'barrier') return 'A traffic gate is still closed.'
  return 'A planter blocks this lane.'
}

export function busNumber(level: LevelDefinition, busId: string): number {
  return level.buses.findIndex((bus) => bus.id === busId) + 1
}
