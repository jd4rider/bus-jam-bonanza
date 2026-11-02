# Puzzle solver

`src/core/solver.ts` is a breadth-first search over the *real* transition function. It never has a private
simplified ruleset; a path it returns can be replayed by `dispatchBus` and will win.

## State identity

The search state is the gameplay state:

- parked bus set (encoded as a bitmask in level order),
- bay occupants and their fill counts (in bay order),
- queue index.

`stateKey` serialises this into `mask|queueIndex|b1:3.b2:6.-`. Gate state is derived from the parked set and bay
occupancy, so it does not need to be stored.

## Algorithm

```
queue = [start]
seen  = {key(start)}
while queue:
  state = shift()
  if victory(state): reconstruct and return
  if states >= budget or time >= limit: return UNKNOWN
  for bus in level.buses order:
    if bus is parked:
      next = dispatchBus(state, bus)   // the real engine
      if legal and not obviously stuck and unseen: enqueue
return UNSOLVABLE
```

Buses are expanded in level order, so ties are broken consistently between runs.

## Pruning

`isObviouslyStuck` is a sound necessary-condition test: for every occupied bay, the remaining queue must contain
at least as many passengers of that colour as the bus still needs. If not, that bus can never fill, so the state
can be discarded without changing the result. Dispatching a bus whose colour no longer appears in the queue is
also pruned by this check.

## Budgets and honesty

- Baking uses `maxStates: 90_000`, `maxMillis: 6_000` per attempt; a failure means “try another layout”.
- Hints use `maxStates: 140_000`, `maxMillis: 1_200` on the current board.
- If a budget is hit, the status is **UNKNOWN**, never UNSOLVABLE. The hint UI says no verified move is available
  and suggests Undo/Restart.
- The campaign validator independently replays every stored solution and re-solves a sample.

## Outputs

`SolveResult` contains `status`, the move list, the number of explored states and an optional reason. The bake
script records `par = moves.length` and `explored` on each level as validation metadata. The solver is also used
to compute the difficulty signal (search effort feeds the score).

## Hints

The hint button solves the *current* state, not the original solution. This matters after a player deviates or
undoes. Three presses give an escalating ladder:

1. Highlight the bus and name it by colour and symbol.
2. Explain why: it reaches a bay, and either its colour is at the front or it frees a lane another colour needs.
3. Auto-play that verified dispatch after a short delay.

Every press increments the hint counter, which feeds the star rating. A deadlocked board returns no move, and the
UI never recommends an illegal action.

## Complexity

The state space is bounded by `2^buses × bay configurations × queue length`. Shipped levels use at most 10 buses
and 96 passengers, and the solver prunes aggressively. A typical campaign solve explores a few hundred to a few
thousand states; the whole 300-level bake and replay completes in well under a second on a laptop. A full search
is never run on the animation frame — only on bake, validation and an explicit hint.
