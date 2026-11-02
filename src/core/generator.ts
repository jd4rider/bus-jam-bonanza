import { clamp, hashString, mulberry32, pick, randInt, shuffle, type Rng } from './rng'
import {
  analyseState,
  busById,
  capacityOf,
  colorOf,
  departureCount,
  firstFreeBay,
  initialState,
  isVictory,
  routeReport,
} from './engine'
import { solveLevel } from './solver'
import {
  BUS_COLORS,
  CAPACITY_BY_LENGTH,
  LEVEL_FORMAT_VERSION,
  cellKey,
  DIR_VECTORS,
  type Barrier,
  type BaySlot,
  type BusColor,
  type BusDefinition,
  type Direction,
  type EngineState,
  type GridPoint,
  type LevelDefinition,
} from './types'

export interface GenerateSpec {
  id: string
  world: number
  index: number
  name: string
  seed: number
  width: number
  height: number
  busCount: number
  bays: number
  colorCount: number
  allowVertical: boolean
  longChance: number
  /** 0 = no traffic gates, 1 = at most one. */
  gates: number
  decoys: number
}

interface Lane {
  horizontal: boolean
  index: number
  direction: Direction
}

const attemptsPerLevel = 48

function segmentBus(lane: Lane, from: number, to: number): BusDefinition {
  const length = to - from + 1
  const position = lane.horizontal
    ? { x: lane.direction === 'east' ? from : to, y: lane.index }
    : { x: lane.index, y: lane.direction === 'south' ? from : to }
  return {
    id: '',
    color: 'red',
    capacity: 4,
    position,
    direction: lane.direction,
    length,
  }
}

function footprint(bus: BusDefinition): GridPoint[] {
  const vector = DIR_VECTORS[bus.direction]
  return Array.from({ length: bus.length }, (_, step) => ({
    x: bus.position.x + vector.x * step,
    y: bus.position.y + vector.y * step,
  }))
}

function pathCells(bus: BusDefinition, width: number, height: number): GridPoint[] {
  const vector = DIR_VECTORS[bus.direction]
  const head = footprint(bus)[bus.length - 1]
  const cells: GridPoint[] = []
  for (let step = 1; step < Math.max(width, height) + 2; step += 1) {
    const point = { x: head.x + vector.x * step, y: head.y + vector.y * step }
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) break
    cells.push(point)
  }
  return cells
}

/**
 * Places buses nose-to-tail in lanes. Contiguous parking is what creates the
 * "who is in front?" puzzle; isolated rows of one bus would be trivial.
 */
function placeFleet(rng: Rng, spec: GenerateSpec): BusDefinition[] | null {
  const used = new Set<string>()
  const buses: BusDefinition[] = []
  const lanes: Lane[] = []

  for (let y = 0; y < spec.height; y += 1) {
    lanes.push({ horizontal: true, index: y, direction: rng() < 0.5 ? 'east' : 'west' })
  }
  if (spec.allowVertical) {
    for (let x = 0; x < spec.width; x += 1) {
      lanes.push({ horizontal: false, index: x, direction: rng() < 0.5 ? 'south' : 'north' })
    }
  }

  for (const lane of shuffle(rng, lanes)) {
    if (buses.length >= spec.busCount) break
    const span = lane.horizontal ? spec.width : spec.height
    const remaining = spec.busCount - buses.length
    let laneCount = Math.min(remaining, randInt(rng, 1, 3), Math.floor(span / 2))
    if (laneCount < 1) continue

    const lengths: number[] = []
    let total = 0
    while (lengths.length < laneCount) {
      const length = rng() < spec.longChance ? 3 : 2
      if (total + length > span) break
      lengths.push(length)
      total += length
    }
    if (!lengths.length) continue
    const offset = randInt(rng, 0, span - total)

    const segments: Array<{ from: number; to: number }> = []
    let cursor = offset
    for (const length of lengths) {
      segments.push({ from: cursor, to: cursor + length - 1 })
      cursor += length
    }

    const planned: BusDefinition[] = segments.map((segment) => segmentBus(lane, segment.from, segment.to))
    const plannedCells = planned.flatMap((bus) => footprint(bus))
    if (plannedCells.some((cell) => used.has(cellKey(cell.x, cell.y)))) continue
    for (const cell of plannedCells) used.add(cellKey(cell.x, cell.y))
    buses.push(...planned)
  }

  // Any shortfall is filled with single buses facing a random edge.
  let guard = 0
  while (buses.length < spec.busCount && guard < 400) {
    guard += 1
    const direction = pick(rng, ['north', 'east', 'south', 'west'] as Direction[])
    const length = rng() < spec.longChance ? 3 : 2
    const x = randInt(rng, 0, spec.width - 1)
    const y = randInt(rng, 0, spec.height - 1)
    const candidate: BusDefinition = {
      id: '',
      color: 'red',
      capacity: 4,
      position: { x, y },
      direction,
      length,
    }
    const cells = footprint(candidate)
    if (cells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= spec.width || cell.y >= spec.height)) continue
    if (cells.some((cell) => used.has(cellKey(cell.x, cell.y)))) continue
    for (const cell of cells) used.add(cellKey(cell.x, cell.y))
    buses.push(candidate)
  }

  if (buses.length < Math.min(spec.busCount, 2)) return null

  // Reject empty parking lots: at least one bus must be boxed in.
  const blocking = buses.some((bus) =>
    buses.some(
      (other) =>
        other !== bus &&
        pathCells(bus, spec.width, spec.height).some((cell) =>
          footprint(other).some((c) => c.x === cell.x && c.y === cell.y),
        ),
    ),
  )
  if (!blocking) return null

  return buses.map((bus, index) => ({ ...bus, id: `b${index + 1}` }))
}

function assignColors(rng: Rng, buses: BusDefinition[], colorCount: number): void {
  const palette = shuffle(rng, BUS_COLORS.slice(0, colorCount))
  const order = shuffle(rng, buses)
  order.forEach((bus, index) => {
    bus.color = palette[index % palette.length]
    const choices = CAPACITY_BY_LENGTH[bus.length] ?? [4]
    bus.capacity = pick(rng, choices as unknown as number[])
  })
}

function placeBarrier(rng: Rng, buses: BusDefinition[], spec: GenerateSpec): Barrier[] {
  if (spec.gates <= 0) return []
  const candidates = shuffle(rng, buses)
  for (const bus of candidates) {
    const free = pathCells(bus, spec.width, spec.height).filter(
      (cell) => !buses.some((other) => footprint(other).some((p) => p.x === cell.x && p.y === cell.y)),
    )
    if (!free.length) continue
    const cell = pick(rng, free)
    return [{ x: cell.x, y: cell.y, opensAfter: randInt(rng, 1, 2) }]
  }
  return []
}

/**
 * Chooses buses that may be left parked for the whole level. A decoy must not
 * sit in the only route of a needed bus, or the puzzle would never be solvable.
 */
function chooseSubset(rng: Rng, buses: BusDefinition[], spec: GenerateSpec): string[] {
  const allIds = buses.map((bus) => bus.id)
  const wanted = Math.min(spec.decoys, Math.max(0, buses.length - spec.colorCount))
  if (wanted <= 0) return allIds

  const colorsInFleet = new Set(buses.map((bus) => bus.color))
  const decoys = new Set<string>()
  for (const candidate of shuffle(rng, buses)) {
    if (decoys.size >= wanted) break
    const rest = buses.filter((bus) => bus.id !== candidate.id && !decoys.has(bus.id))
    const colorsLeft = new Set(rest.map((bus) => bus.color))
    if (colorsLeft.size < colorsInFleet.size) continue
    const candidateCells = new Set(footprint(candidate).map((cell) => cellKey(cell.x, cell.y)))
    const blocksNeededBus = rest.some((bus) =>
      pathCells(bus, spec.width, spec.height).some((cell) => candidateCells.has(cellKey(cell.x, cell.y))),
    )
    if (blocksNeededBus) continue
    decoys.add(candidate.id)
  }
  return allIds.filter((id) => !decoys.has(id))
}

interface Constructed {
  queue: BusColor[]
  order: string[]
}

/**
 * Builds the passenger queue and a matching dispatch order by simulating the
 * real rules. Because every passenger we append matches a bus that is already
 * in a bay, the recorded dispatch order is a guaranteed solution.
 */
function constructQueue(level: LevelDefinition, subsetIds: string[], rng: Rng): Constructed | null {
  const parked = new Set(level.buses.map((bus) => bus.id))
  const remaining = new Set(subsetIds)
  const bays: BaySlot[] = Array.from({ length: level.bays }, () => null)
  const queue: BusColor[] = []
  const order: string[] = []

  const currentState = (): EngineState => ({
    parked: level.buses.filter((bus) => parked.has(bus.id)).map((bus) => bus.id),
    bays,
    queueIndex: 0,
  })

  for (let step = 0; step < 900; step += 1) {
    if (remaining.size === 0 && bays.every((slot) => slot === null)) return { queue, order }

    const freeBay = bays.findIndex((slot) => slot === null)
    const targets = bays
      .map((slot, index) => ({ slot, index }))
      .filter((entry) => entry.slot !== null && entry.slot.filled < capacityOf(level, entry.slot.busId))

    const state = currentState()
    const dispatchable = [...remaining].filter((busId) => freeBay >= 0 && routeReport(level, state, busId).clear)
    const mustDispatch = targets.length === 0
    const wantsDispatch = dispatchable.length > 0 && rng() < 0.5

    if (mustDispatch || wantsDispatch) {
      if (!dispatchable.length) return null
      const busId = pick(rng, dispatchable)
      const bayIndex = bays.findIndex((slot) => slot === null)
      bays[bayIndex] = { busId, filled: 0 }
      parked.delete(busId)
      remaining.delete(busId)
      order.push(busId)
      continue
    }

    const target = pick(rng, targets)
    if (!target.slot) return null
    const color = colorOf(level, target.slot.busId)
    // The game always feeds the lowest-numbered matching bay, so mirror that
    // here or the constructed solution could diverge from the real one.
    const priority = bays.findIndex(
      (slot) => slot !== null && slot.filled < capacityOf(level, slot.busId) && colorOf(level, slot.busId) === color,
    )
    const bayIndex = priority >= 0 ? priority : target.index
    const slot = bays[bayIndex]
    if (!slot) return null
    queue.push(color)
    slot.filled += 1
    if (slot.filled >= capacityOf(level, slot.busId)) bays[bayIndex] = null
  }

  return null
}

function blockingPairs(level: LevelDefinition): number {
  let pairs = 0
  for (const bus of level.buses) {
    const own = new Set(footprint(bus).map((cell) => cellKey(cell.x, cell.y)))
    const path = pathCells(bus, level.width, level.height)
    const blocked = level.buses.some(
      (other) =>
        other.id !== bus.id &&
        footprint(other).some((cell) => !own.has(cellKey(cell.x, cell.y)) && path.some((p) => p.x === cell.x && p.y === cell.y)),
    )
    if (blocked) pairs += 1
  }
  return pairs
}

export function measureDifficulty(level: LevelDefinition, explored: number): number {
  const pairs = blockingPairs(level)
  let changes = 0
  for (let index = 1; index < level.queue.length; index += 1) {
    if (level.queue[index] !== level.queue[index - 1]) changes += 1
  }
  const interleave = level.queue.length > 1 ? changes / (level.queue.length - 1) : 0
  const usedBuses = new Set(level.solution).size
  const decoys = Math.max(0, level.buses.length - usedBuses)
  const score =
    0.9 +
    level.buses.length * 0.26 +
    new Set(level.buses.map((bus) => bus.color)).size * 0.55 +
    pairs * 0.5 +
    (5 - level.bays) * 0.55 +
    level.barriers.length * 1.25 +
    decoys * 1.1 +
    Math.log10(explored + 1) * 0.95 +
    interleave * 1.25
  return Math.round(clamp(score, 1, 10) * 10) / 10
}

export function generateLevel(spec: GenerateSpec): LevelDefinition | null {
  for (let attempt = 0; attempt < attemptsPerLevel; attempt += 1) {
    const rng = mulberry32((spec.seed + attempt * 0x9e3779b1) >>> 0)
    const fleet = placeFleet(rng, spec)
    if (!fleet) continue

    assignColors(rng, fleet, spec.colorCount)
    const barriers = placeBarrier(rng, fleet, spec)
    const subset = chooseSubset(rng, fleet, spec)

    const draft: LevelDefinition = {
      id: spec.id,
      world: spec.world,
      index: spec.index,
      name: spec.name,
      width: spec.width,
      height: spec.height,
      buses: fleet,
      queue: [],
      bays: spec.bays,
      barriers,
      obstacles: [],
      difficulty: 1,
      par: 0,
      solution: [],
      explored: 0,
      seed: `${spec.seed}:${attempt}`,
      version: LEVEL_FORMAT_VERSION,
    }

    const constructed = constructQueue(draft, subset, rng)
    if (!constructed || !constructed.queue.length) continue
    draft.queue = constructed.queue

    const start = initialState(draft)
    if (isVictory(draft, start)) continue

    const solved = solveLevel(draft, start, { maxStates: 90_000, maxMillis: 6000 })
    if (solved.status !== 'solved') continue

    draft.solution = solved.moves
    draft.par = solved.moves.length
    draft.explored = solved.explored
    draft.difficulty = measureDifficulty(draft, solved.explored)
    draft.seed = `${spec.seed}:${attempt}`
    return draft
  }
  return null
}

/** World tuning. Each world leans a little harder on the previous one. */
export interface WorldTuning {
  width: number
  height: number
  minBuses: number
  maxBuses: number
  bays: number
  colors: number
  allowVertical: boolean
  longChance: number
  gates: number
  decoys: number
}

export const WORLD_TUNING: WorldTuning[] = [
  { width: 6, height: 4, minBuses: 3, maxBuses: 5, bays: 3, colors: 2, allowVertical: false, longChance: 0, gates: 0, decoys: 0 },
  { width: 7, height: 4, minBuses: 4, maxBuses: 6, bays: 3, colors: 3, allowVertical: false, longChance: 0.05, gates: 0, decoys: 0 },
  { width: 7, height: 5, minBuses: 5, maxBuses: 7, bays: 4, colors: 3, allowVertical: true, longChance: 0.08, gates: 0, decoys: 0 },
  { width: 8, height: 5, minBuses: 6, maxBuses: 7, bays: 4, colors: 4, allowVertical: true, longChance: 0.12, gates: 0, decoys: 0 },
  { width: 8, height: 6, minBuses: 6, maxBuses: 8, bays: 4, colors: 4, allowVertical: true, longChance: 0.18, gates: 0, decoys: 1 },
  { width: 8, height: 6, minBuses: 7, maxBuses: 8, bays: 5, colors: 4, allowVertical: true, longChance: 0.22, gates: 0, decoys: 1 },
  { width: 9, height: 6, minBuses: 7, maxBuses: 9, bays: 4, colors: 5, allowVertical: true, longChance: 0.28, gates: 1, decoys: 1 },
  { width: 9, height: 6, minBuses: 8, maxBuses: 9, bays: 4, colors: 5, allowVertical: true, longChance: 0.32, gates: 1, decoys: 1 },
  { width: 9, height: 7, minBuses: 8, maxBuses: 10, bays: 3, colors: 6, allowVertical: true, longChance: 0.38, gates: 1, decoys: 2 },
  { width: 10, height: 7, minBuses: 9, maxBuses: 10, bays: 3, colors: 6, allowVertical: true, longChance: 0.42, gates: 1, decoys: 2 },
]

export function specFor(world: number, index: number, name: string): GenerateSpec {
  const tuning = WORLD_TUNING[world - 1] ?? WORLD_TUNING[WORLD_TUNING.length - 1]
  const progress = Math.min(1, index / 29)
  const busCount = Math.round(tuning.minBuses + (tuning.maxBuses - tuning.minBuses) * progress)
  const bays = tuning.bays + (index % 10 === 0 && world >= 3 && tuning.bays < 5 ? 1 : 0)
  const globalIndex = (world - 1) * 30 + index
  const gates = tuning.gates > 0 && index % 11 >= 6 && world >= 7 ? 1 : 0
  const decoys = tuning.decoys > 0 && index % 7 === 0 ? Math.min(tuning.decoys, 2) : 0
  return {
    id: `level-${String(globalIndex + 1).padStart(3, '0')}`,
    world,
    index,
    name,
    seed: hashString(`bus-jam-bonanza:${world}:${index}:v1`),
    width: tuning.width,
    height: tuning.height,
    busCount,
    bays,
    colorCount: Math.min(tuning.colors, busCount),
    allowVertical: tuning.allowVertical,
    longChance: tuning.longChance,
    gates,
    decoys,
  }
}

/** Used by tests and the daily fallback: is this state truly stuck? */
export function explain(level: LevelDefinition, state: EngineState): string {
  const analysis = analyseState(level, state)
  if (analysis.victory) return 'solved'
  if (!analysis.deadlocked) return 'still playable'
  if (analysis.reason === 'bays-full') return 'all boarding bays are full'
  if (analysis.reason === 'stranded') return 'passengers are gone but a bus is still waiting'
  return 'every remaining bus is blocked'
}

/** Re-exported so scripts can verify a level without a second import. */
export { busById, departureCount, firstFreeBay }
