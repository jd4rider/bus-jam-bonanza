# Traffic engine

The engine lives in `src/core/engine.ts` and is pure TypeScript: no Phaser, no DOM, no timers.

## Logical board

- Integer grid `width × height`, origin top-left.
- A bus is a straight footprint of `length` cells (2 for 4/6-seat buses, 3 for 8/12-seat buses) extending from
  its **rear** cell along one fixed `direction`: north, east, south or west.
- Cells are either road, solid obstacle or closed/open traffic gate. There are no diagonal moves.
- Buses never turn. “One-way lanes” are the fixed direction of each bus; arrows at the lot edge show the exit.

`busCells(bus)` expands the footprint. A level index caches cell ownership so two buses can never occupy the same
cell; `validateLevel` checks this before shipping.

## Route legality

For a tapped bus the engine walks cells from the cell ahead of its head to the board edge:

- outside the board → the bus can leave, route clear;
- solid obstacle → blocked;
- closed barrier → blocked until enough buses have departed;
- another **parked** bus → blocked by that bus;
- otherwise continue.

Only the head path needs scanning because movement is straight and the footprint is already clear. The whole
footprint still matters: dispatching is refused unless every body cell remains clear all the way out. The
`RouteReport` also returns the crossed cells for the exit animation.

## State

```ts
interface EngineState {
  parked: string[]        // ids still in the lot, in level order
  bays: (BayOccupant | null)[]  // fixed bay slots, index === bay number
  queueIndex: number      // number of passengers already boarded
}
```

A bus is either parked, in exactly one bay, or departed. That makes the state compact and undo trivial.
Gate openings are derived, not stored:

```
dispatched = totalBuses - parked.length
occupied   = number of non-null bays
departures = dispatched - occupied
gate open  = departures >= barrier.opensAfter
```

## Transition

`dispatchBus(level, state, busId)` is the only gameplay action:

1. Refuse if the bus is not parked.
2. Refuse if no bay is free (`no-bay`).
3. Refuse if the route is blocked (`blocked`, with the first blocker).
4. Clone the state, remove the bus, place it in the lowest-numbered free bay.
5. Run boarding to exhaustion (see BOARDING_RULES.md).
6. Return the new state, the bay index, the exit route, every boarding step and every departure.

The result is deterministic and computed before animation starts. A second tap while a bus is in transit is
rejected by the scene's input lock, so animations cannot corrupt state.

## Analysis

`analyseState` returns:

- `victory` — queue empty and every bay empty;
- `dispatchable` — parked buses with a clear route and a free bay;
- `blocked` — blocker per parked bus;
- `deadlocked` — queue still has passengers, the front colour cannot board any bay bus, and no bus can be
  dispatched.

Boarding is automatic, so a state that could board would already have boarded. A full bay alone is **not** a
deadlock: if any bus can still leave, the player has a move. If the queue is empty but a half-full bus is still
in a bay, that is a real `stranded` deadlock and the game reports it rather than claiming victory.

## Gates

A gate cell is a barrier with `opensAfter` (1–2). Closed gates block routes and are drawn as striped barriers
with a count. Departures are monotonic, so a gate can only open, which keeps the search finite and the puzzle
fair. A level never requires a gate to open without another dispatchable bus to open it.

## Obstacles

Solid cells are supported by the engine and validator. The shipped campaign uses decorative props only; no
level relies on an obstacle because the current generator does not place them.

## Why no pathfinding?

The chosen movement model is deliberately the *simplest one that produces real traffic puzzles*: straight,
one-way exits and nose-to-tail parking. It is legible on a small screen, cheap to solve and easy to explain.
A* over turning road networks would add routes, but also ambiguity about which path a tap means. If turning
routes are added later, the transition function is the single place to change, and the solver and generator
will pick it up automatically because they call the same functions.
