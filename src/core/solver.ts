import {
  dispatchBus,
  initialState,
  isObviouslyStuck,
  isVictory,
  stateKey,
} from './engine'
import type { EngineState, LevelDefinition } from './types'

export interface SolveOptions {
  maxStates?: number
  /** 0 or undefined disables the wall-clock guard. */
  maxMillis?: number
}

export interface SolveResult {
  status: 'solved' | 'unsolvable' | 'unknown'
  moves: string[]
  explored: number
  reason?: 'budget' | 'time'
  finalState?: EngineState
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Breadth-first search over the *real* transition engine. Every action is a
 * legal dispatch, and boarding runs exactly as it does in the game, so a
 * found path is a solution the player can actually reproduce.
 */
export function solveLevel(
  level: LevelDefinition,
  start: EngineState = initialState(level),
  options: SolveOptions = {},
): SolveResult {
  const maxStates = options.maxStates ?? 120_000
  const maxMillis = options.maxMillis ?? 0
  const started = now()
  const startKey = stateKey(level, start)
  if (isVictory(level, start)) return { status: 'solved', moves: [], explored: 1, finalState: start }

  const states: EngineState[] = [start]
  const parents: number[] = [-1]
  const moves: Array<string | null> = [null]
  const seen = new Set<string>([startKey])
  let head = 0

  while (head < states.length) {
    const state = states[head]
    if (isVictory(level, state)) {
      const path: string[] = []
      let cursor = head
      while (cursor > 0) {
        const move = moves[cursor]
        if (move) path.push(move)
        cursor = parents[cursor]
      }
      path.reverse()
      return { status: 'solved', moves: path, explored: states.length, finalState: state }
    }

    if (states.length >= maxStates) return { status: 'unknown', moves: [], explored: states.length, reason: 'budget' }
    if (maxMillis > 0 && now() - started > maxMillis) {
      return { status: 'unknown', moves: [], explored: states.length, reason: 'time' }
    }

    for (const bus of level.buses) {
      if (!state.parked.includes(bus.id)) continue
      const result = dispatchBus(level, state, bus.id)
      if (!result.ok) continue
      if (isObviouslyStuck(level, result.state)) continue
      const key = stateKey(level, result.state)
      if (seen.has(key)) continue
      seen.add(key)
      states.push(result.state)
      parents.push(head)
      moves.push(bus.id)
    }
    head += 1
  }

  return { status: 'unsolvable', moves: [], explored: states.length }
}

/** Replays a dispatch list through the gameplay engine and checks victory. */
export function replaySolution(
  level: LevelDefinition,
  moves: readonly string[],
): { ok: boolean; state: EngineState; failure?: string } {
  let state = initialState(level)
  for (const busId of moves) {
    const result = dispatchBus(level, state, busId)
    if (!result.ok) return { ok: false, state, failure: `illegal move ${busId} (${result.reason})` }
    state = result.state
  }
  if (!isVictory(level, state)) return { ok: false, state, failure: 'sequence does not clear the queue' }
  return { ok: true, state }
}

/** The next verified dispatch from the current position, for hints. */
export function nextSolutionMove(
  level: LevelDefinition,
  state: EngineState,
  options: SolveOptions = {},
): { move: string | null; status: SolveResult['status']; explored: number } {
  const result = solveLevel(level, state, options)
  return { move: result.status === 'solved' ? (result.moves[0] ?? null) : null, status: result.status, explored: result.explored }
}
