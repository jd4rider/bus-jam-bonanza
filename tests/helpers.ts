import type { BusColor, BusDefinition, LevelDefinition } from '../src/core/types'

export interface FixtureInput {
  width: number
  height: number
  bays: number
  buses: BusDefinition[]
  queue: BusColor[]
  barriers?: Array<{ x: number; y: number; opensAfter: number }>
  obstacles?: Array<{ x: number; y: number }>
}

export function makeLevel(input: FixtureInput, id = 'fixture'): LevelDefinition {
  return {
    id,
    world: 1,
    index: 0,
    name: 'Fixture',
    width: input.width,
    height: input.height,
    buses: input.buses,
    queue: input.queue,
    bays: input.bays,
    barriers: input.barriers ?? [],
    obstacles: input.obstacles ?? [],
    difficulty: 1,
    par: 1,
    solution: [],
    explored: 0,
    seed: 'fixture',
    version: 1,
  }
}

export function bus(
  id: string,
  color: BusColor,
  capacity: number,
  x: number,
  y: number,
  direction: BusDefinition['direction'] = 'east',
  length = 2,
): BusDefinition {
  return { id, color, capacity, position: { x, y }, direction, length }
}
