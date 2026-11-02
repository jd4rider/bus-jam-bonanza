import { busCells, isVictory } from './engine'
import { replaySolution } from './solver'
import { CAPACITY_BY_LENGTH, cellKey, type LevelDefinition } from './types'

/** Full static + replay validation for one baked level. */
export function validateLevel(level: LevelDefinition): string[] {
  const errors: string[] = []
  const fail = (message: string): void => {
    errors.push(`${level.id}: ${message}`)
  }

  if (!level.id) fail('missing id')
  if (!Number.isInteger(level.width) || level.width < 3 || level.width > 14) fail('width out of range')
  if (!Number.isInteger(level.height) || level.height < 3 || level.height > 14) fail('height out of range')
  if (!Number.isInteger(level.bays) || level.bays < 1 || level.bays > 6) fail('bay count out of range')
  if (!level.buses.length) fail('no buses')
  if (!level.queue.length) fail('empty passenger queue')

  const ids = new Set<string>()
  const occupied = new Map<string, string>()
  for (const bus of level.buses) {
    if (ids.has(bus.id)) fail(`duplicate bus id ${bus.id}`)
    ids.add(bus.id)
    if (!['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'].includes(bus.color)) {
      fail(`bus ${bus.id} has invalid colour`)
    }
    const allowed = CAPACITY_BY_LENGTH[bus.length]
    if (!allowed || !allowed.includes(bus.capacity)) fail(`bus ${bus.id} has mismatched length/capacity`)
    const cells = busCells(bus)
    for (const cell of cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= level.width || cell.y >= level.height) {
        fail(`bus ${bus.id} leaves the board`)
      }
      const key = cellKey(cell.x, cell.y)
      const other = occupied.get(key)
      if (other) fail(`bus ${bus.id} overlaps ${other}`)
      occupied.set(key, bus.id)
    }
  }

  for (const barrier of level.barriers) {
    if (barrier.x < 0 || barrier.y < 0 || barrier.x >= level.width || barrier.y >= level.height) {
      fail('barrier outside the board')
    }
    if (!Number.isInteger(barrier.opensAfter) || barrier.opensAfter < 1) fail('barrier opensAfter must be >= 1')
    if (occupied.has(cellKey(barrier.x, barrier.y))) fail('barrier sits under a bus')
  }
  for (const obstacle of level.obstacles) {
    if (occupied.has(cellKey(obstacle.x, obstacle.y))) fail('obstacle sits under a bus')
  }

  const colorSeats = new Map<string, number>()
  for (const bus of level.buses) colorSeats.set(bus.color, (colorSeats.get(bus.color) ?? 0) + bus.capacity)
  const colorPassengers = new Map<string, number>()
  for (const color of level.queue) colorPassengers.set(color, (colorPassengers.get(color) ?? 0) + 1)
  for (const [color, count] of colorPassengers) {
    if ((colorSeats.get(color) ?? 0) < count) fail(`not enough ${color} seats`)
  }
  const totalSeats = level.buses.reduce((sum, bus) => sum + bus.capacity, 0)
  if (totalSeats < level.queue.length) fail('total capacity is below passenger count')

  if (isVictory(level, { parked: level.buses.map((bus) => bus.id), bays: Array(level.bays).fill(null), queueIndex: 0 })) {
    fail('level starts solved')
  }

  if (!level.solution.length) fail('missing verified solution')
  const replay = replaySolution(level, level.solution)
  if (!replay.ok) fail(`solution replay failed: ${replay.failure ?? 'unknown'}`)
  if (level.par !== level.solution.length) fail('par does not match the solution length')

  return errors
}
