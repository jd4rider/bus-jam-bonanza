# Boarding rules

## Queue

The queue is a deterministic array of colours in `level.queue`. `state.queueIndex` is the number of passengers
already boarded, so `queue.slice(queueIndex)` is the visible queue. The front passenger is the next eligible
passenger. No passenger may jump ahead or be reordered.

Visually the queue wraps around an oval plaza, with the front marked by a gold ring and a NEXT tag. The view is a
presentation of the array; gameplay never depends on sprite positions.

Consecutive passengers may share a colour naturally. The queue order is preserved even when the art groups them.

## Matching

After every dispatch, boarding runs to exhaustion:

1. Read the front passenger's colour.
2. Search the bay array from index 0 upward for an occupant with that colour and a free seat.
3. If there is none, stop — even if a later passenger could board.
4. Otherwise increment that bus's occupancy, advance `queueIndex`, and record a `BoardingStep`.
5. If the bus is now full, it departs immediately and its bay becomes null.
6. Repeat from step 1.

The priority rule is *lowest-numbered matching bay*, which is also the earliest bay for the common case. It is
documented, deterministic and mirrored exactly by the generator's construction and the solver.

## Capacities

| Class | Capacity | Footprint |
| --- | --- | --- |
| Mini bus | 4 | 2 cells |
| Standard bus | 6 | 2 cells |
| Large bus | 8 | 3 cells |
| Double-decker | 12 | 3 cells |

A level may mix classes. Capacity is per bus and is never inferred from the queue.

## Departure

A bus departs only when `filled === capacity`. There is no manual “send empty” action and no partial departure.
Departure frees the bay, increments the derived departure count (opening gates) and plays a confetti burst.

A bus left in a bay with too few matching passengers can never leave. That is intentional: it is the central
risk of choosing the wrong fleet. The deadlock analyser and solver both model it.

## Victory

Victory requires:

- `queueIndex === queue.length` (every passenger boarded), and
- every bay is empty (no half-full bus waiting).

Parked buses may remain. Levels are allowed to contain surplus buses; the player is never required to dispatch
them. This creates a real “which fleet do I need?” decision and keeps par below the total bus count on those
stops. Early worlds use an exact fleet; later worlds add decoys.

## Determinism checklist

- The queue is an array, not a set or sprite order.
- Priority is by bay index, not arrival time or animation timing.
- Boarding runs synchronously inside `dispatchBus` before any tween is created.
- The scene renders the already-final state; undo restores logical snapshots, never visual state.
- The generator's constructed queue targets the same priority bus the game will pick.
