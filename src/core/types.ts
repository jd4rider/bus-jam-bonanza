// Core data model for Bus Jam Bonanza. Deliberately free of Phaser and of any
// browser API so the engine, solver, generator and tests can run in Node.

export const BUS_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as const
export type BusColor = (typeof BUS_COLORS)[number]

export type Direction = 'north' | 'east' | 'south' | 'west'

export type SymbolShape = 'square' | 'circle' | 'triangle' | 'star' | 'diamond' | 'cross' | 'heart' | 'hex'

export interface ColorMeta {
  name: string
  symbol: SymbolShape
  hex: number
  css: string
  deep: number
  light: number
}

export const COLOR_META: Record<BusColor, ColorMeta> = {
  red: { name: 'Red', symbol: 'square', hex: 0xef5f5b, css: '#ef5f5b', deep: 0xb93a3a, light: 0xff9a94 },
  blue: { name: 'Blue', symbol: 'circle', hex: 0x4f8ff0, css: '#4f8ff0', deep: 0x2f5fae, light: 0x9dc3ff },
  green: { name: 'Green', symbol: 'triangle', hex: 0x4fb98a, css: '#4fb98a', deep: 0x2f7f5c, light: 0x9be2c3 },
  yellow: { name: 'Yellow', symbol: 'star', hex: 0xf2c94c, css: '#f2c94c', deep: 0xbf9420, light: 0xffe9a3 },
  purple: { name: 'Purple', symbol: 'diamond', hex: 0xa07af0, css: '#a07af0', deep: 0x6f4fbd, light: 0xd0bcff },
  orange: { name: 'Orange', symbol: 'cross', hex: 0xf2914b, css: '#f2914b', deep: 0xbf6428, light: 0xffc596 },
  pink: { name: 'Pink', symbol: 'heart', hex: 0xef7fb8, css: '#ef7fb8', deep: 0xba4f86, light: 0xffb8d7 },
  cyan: { name: 'Cyan', symbol: 'hex', hex: 0x4cc7d6, css: '#4cc7d6', deep: 0x2b8e9d, light: 0xa9eef7 },
}

export interface GridPoint {
  x: number
  y: number
}

export interface BusDefinition {
  id: string
  color: BusColor
  capacity: number
  /** Rear cell. The bus extends `direction` for `length` cells. */
  position: GridPoint
  direction: Direction
  length: number
}

/** A striped barrier that lifts after a number of bus departures. */
export interface Barrier {
  x: number
  y: number
  opensAfter: number
}

/** Immutable, fully baked level definition. */
export interface LevelDefinition {
  id: string
  world: number
  index: number
  name: string
  width: number
  height: number
  buses: BusDefinition[]
  queue: BusColor[]
  bays: number
  barriers: Barrier[]
  /** Solid cells (walls / planters). Always block a route. */
  obstacles: GridPoint[]
  difficulty: number
  par: number
  solution: string[]
  explored: number
  seed: string
  version: number
}

export interface LevelManifest {
  format: number
  generator: string
  levels: LevelDefinition[]
}

export interface BayOccupant {
  busId: string
  filled: number
}

export type BaySlot = BayOccupant | null

/** Runtime state. Immutable by convention: every transition returns a copy. */
export interface EngineState {
  /** Ids of buses still in the parking lot, in level order. */
  parked: string[]
  /** One slot per boarding bay, index === bay number. */
  bays: BaySlot[]
  queueIndex: number
}

export interface BoardingStep {
  busId: string
  bayIndex: number
  color: BusColor
  filled: number
  capacity: number
  departed: boolean
  /** Queue index consumed by this passenger. */
  passenger: number
}

export type BlockKind = 'bus' | 'barrier' | 'obstacle'

export interface Blocker {
  kind: BlockKind
  x: number
  y: number
  busId?: string
}

export interface RouteReport {
  /** Cells the bus head crosses, ending at the board edge (exclusive). */
  cells: GridPoint[]
  clear: boolean
  blocker?: Blocker
}

export type DispatchFailure = 'not-parked' | 'no-bay' | 'blocked'

export interface DispatchResult {
  ok: boolean
  reason?: DispatchFailure
  blocker?: Blocker
  state: EngineState
  bayIndex: number
  route: GridPoint[]
  boarding: BoardingStep[]
  departed: string[]
}

export interface StateAnalysis {
  victory: boolean
  deadlocked: boolean
  dispatchable: string[]
  blocked: Record<string, Blocker>
  reason: 'solved' | 'bays-full' | 'blocked' | 'stranded'
}

export const DIR_VECTORS: Record<Direction, GridPoint> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
}

export const DIR_ANGLE: Record<Direction, number> = {
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
  north: -Math.PI / 2,
}

export const CAPACITY_BY_LENGTH: Record<number, readonly number[]> = {
  2: [4, 6],
  3: [8, 12],
}

export const LEVELS_PER_WORLD = 30
export const WORLD_COUNT = 10
export const TOTAL_LEVELS = LEVELS_PER_WORLD * WORLD_COUNT
export const LEVEL_FORMAT_VERSION = 1

export const cellKey = (x: number, y: number): string => `${x},${y}`

export const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y
