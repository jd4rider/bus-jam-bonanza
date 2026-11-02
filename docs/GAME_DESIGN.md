# Game design

## Fantasy

You are the dispatcher at a tiny, impossibly cheerful bus depot. The lot is packed nose-to-tail. Passengers
wait around a looping stop, each with a colour and a symbol. Your job is not driving — it is *ordering*:
choose which bus leaves next so the right colour reaches a bay before the whole lot locks up.

## Core loop

1. Read the queue front colour and the board.
2. Tap a bus whose lane is clear.
3. Watch it drive to the lowest free bay.
4. Passengers of the front colour walk aboard.
5. A full bus departs with a confetti pop and frees the bay.
6. Check the new traffic picture; repeat.
7. Clear the queue without stranding a half-full bus in a bay.

The logical result is computed before the first pixel moves. Animation never decides an outcome.

## Design pillars

1. **Easy to read.** One direction per bus, one route to the edge, one bay order. Blocked buses shake and
   explain themselves instead of failing silently.
2. **Real traffic problems.** Buses do not teleport through each other; the whole footprint must be clear.
   The puzzle is the order, not reflexes.
3. **No pressure.** No timer, energy, lives or forced waiting. Undo is unlimited. Hints come from the solver.
4. **Short sessions.** World 1 stops are three buses and a handful of passengers. Later boards fit in a few
   minutes and can be left mid-level: the session is saved.
5. **Rewarding polish.** Chimes, engine horns, wheels and roof highlights, a circular passenger plaza, star
   reveals, departure confetti and a gentle generated music loop.

## Modes

| Mode | Rules |
| --- | --- |
| Journey | 300 deterministic levels, ten worlds, stars and unlocks. |
| Zen | Any unlocked stop, relaxed framing, unlimited retries and undo. |
| Daily | A fixed validated level selected by UTC date from the hardest pool. Same board for every player that day. |
| Expert | Hard validated stops (world 7+) with par visible. Optional self-imposed move target. |
| Endless | A deterministic sequence of validated stops; each clear adds to the run. Never unverified content. |
| Free Play | Replay any unlocked stop to improve stars and best moves. |

## Stars

- **3 stars:** clear at or below the solver's minimum dispatch count with no hints.
- **2 stars:** clear within par + 2 using at most two hints.
- **1 star:** clear by any other route.

Because a full bus can never leave early, every winning run dispatches exactly the buses it needs; stars reward
choosing the right fleet and avoiding wasted dispatches and hints. Surplus buses make the par gap visible.

## Ten worlds

| # | World | Teaches | Look |
| --- | --- | --- | --- |
| 1 | Sunny Bus Depot | Tap, colour match, bays, blocking | Bright pavement, depot props |
| 2 | Downtown Dash | Longer buses, tighter blocks | City blocks |
| 3 | Parkside Pickup | Cross traffic, four bays | Green park |
| 4 | Beach Bus Bash | One-way lanes, capacity | Sand and palms |
| 5 | Mountain Transit | Large buses, spare buses | Pines and cool light |
| 6 | Candy Commute | Mixed queues, five bays | Pink candy town |
| 7 | Neon Night Routes | Traffic gates | Night neon |
| 8 | Airport Express | Long queues | Terminal greys and blues |
| 9 | Festival Frenzy | Crowded queues, three bays | Warm festival |
| 10 | Grand Transit Challenge | Everything together | Deep blue hub |

Each world uses its own palette, props, name set and tuning. Level names are deterministic, e.g.
“Sunny Stop”, “Sunny Lane”, “Sunny Loop”.

## Accessibility

- Every colour also has a symbol (square, circle, triangle, star, diamond, cross, heart, hexagon) on the bus roof
  and on each passenger's shirt.
- High-contrast mode outlines buses and passengers.
- Reduced-motion mode removes bobbing, shortens celebrations and speeds animations.
- Animation speed can be set to 0.7×, 1× or 1.4×.
- Separate sound and music toggles; audio starts only after a gesture.
- Keyboard: U/Z undo, Y redo, R restart, H hint, Esc pause.
- Screen-reader announcements for dispatches, blocked moves, undo, victory and deadlocks via `aria-live`.
- Touch targets are large; the canvas disables page scrolling and rubber-banding.

## Progression and retention

- Stars per level, best moves, world star totals, unlock of the next stop.
- Ten achievements from First Departure to Grand Depot Champion.
- Daily results and an Endless best run.
- In-progress session recovery from the main menu.
- No loss of progress when offline; the save is local first.

## Monetization readiness (inactive)

No ads or purchases are active. The intended hooks are an optional inter-level ad slot that asks
`arcade.adsAllowed()` before rendering, an ad-free entitlement (`arcade.ad_free` / `busjambonanza.ad_free`),
cosmetic bus skins and premium themes (`busjambonanza.premium_themes`). Core progression is fully playable
without any of it. Do not place an ad inside an active puzzle.
