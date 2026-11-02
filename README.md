# Bus Jam Bonanza

A cozy 2.5D bus-dispatch and colour-matching puzzle for [Little Joy Arcade](https://littlejoyarcade.site).
Tap buses out of a crowded parking lot, route them to limited boarding bays, and board the colourful
passengers waiting around the loop. Full buses depart, free a bay, and the traffic eases — if you chose the
right order.

Planned production URL: `https://busjambonanza.littlejoyarcade.site`

## What is in the box

- **300 validated Journey levels** across ten themed worlds, baked from a deterministic generator and
  replayed through the real engine by the test suite.
- **Six modes:** Journey, Zen, Daily Challenge, Expert, Endless and Free Play.
- **Deterministic traffic engine** with occupancy-aware routes, swept footprints, one-way lanes, traffic gates,
  limited boarding bays and automatic deadlock analysis.
- **BFS puzzle solver** used to verify every shipped level and to drive three-stage hints from the current board.
- **2.5D presentation drawn entirely in code:** rounded toy buses, expressive passengers, raised roads, kerbs,
  shadows, lane arrows, boarding chimes, departure confetti. No external art or audio assets to license.
- **Local-first saves** (`localStorage`) with a versioned schema, in-progress session recovery, achievements,
  stars and settings. The Little Joy Arcade drop-in client mirrors saves to an account when one is signed in.
- **Mobile and desktop controls**, portrait and landscape layouts, keyboard shortcuts, reduced-motion and
  high-contrast options, and colourblind-friendly symbols on every bus and passenger.
- **Vitest** logic/solver/generator/campaign tests and a **Playwright** browser smoke test.

## Stack

| Concern | Choice |
| --- | --- |
| Engine | Phaser 3.90 |
| Language | TypeScript, strict |
| Build | Vite 6 |
| Unit tests | Vitest 3 |
| Browser tests | Playwright |
| Storage | localStorage with in-memory fallback |
| Platform | `arcade-client.js` drop-in for Little Joy Arcade |

## Commands

```bash
npm install
npm run dev          # http://localhost:5174
npm run bake         # regenerate 300 levels + src/data/levels.json
npm run validate     # re-check every shipped level and replay every solution
npm test             # Vitest: engine, solver, generator, campaign, saves
npm run typecheck
npm run build        # tsc --noEmit + vite build
npm run e2e          # Playwright (install Chromium once with npx playwright install chromium)
```

## Project layout

```
src/core/       engine, solver, generator, campaign, saves, modes, audio, arcade adapter
src/phaser/     Menu, Worlds, Levels, Game, Achievements, Settings scenes + art helpers
src/data/       levels.json (300 baked, versioned levels)
scripts/        bake-levels.ts, validate-levels.ts
tests/          Vitest suites + tests/e2e Playwright spec
docs/           the ten design and engineering documents
```

## Game rules in one minute

1. Every bus drives in one fixed direction. Its whole body must be able to reach the edge of the lot.
2. Tap a bus with a clear lane and a free bay. It drives to the lowest-numbered free bay.
3. Passengers board strictly from the front of the queue, and only into a bus of their colour in a bay.
4. The lowest-numbered matching bay gets the passenger. A full bus departs immediately and frees its bay.
5. A level is complete when the queue is empty and no bus is left waiting in a bay. Levels may contain surplus
   buses that can stay parked — they are useful decoys, not required passengers.
6. If every remaining bus is blocked and no bay can board the next passenger, the game says so and offers
   Undo, Restart and a hint. There is no timer, energy meter or forced ad.

Full detail: [TRAFFIC_ENGINE.md](TRAFFIC_ENGINE.md), [BOARDING_RULES.md](BOARDING_RULES.md),
[PUZZLE_SOLVER.md](PUZZLE_SOLVER.md) and [LEVEL_GENERATION.md](LEVEL_GENERATION.md).

## Status and honest limitations

- The ten worlds and 300 Journey levels are complete and verified; the six modes are playable.
- Special mechanics shipped: one-way lanes (the fixed bus directions), traffic gates, surplus/decoy buses and
  large vehicles. VIP passengers, express buses, mystery buses, temporary bays and road switches are
  **not** shipped, because each needs solver and generator support before it can appear in a published level.
- The game is local-first. The Little Joy Arcade drop-in client mirrors local storage when a player signs in;
  cloud achievement/entitlement writes require platform service work and are not activated here.
- No advertising or payment surface is active. Entitlement checks are read-only readiness hooks.
- Playwright requires a browser download; see [TESTING.md](docs/TESTING.md) for the exact commands and results.

Built with Phaser 3 and TypeScript for Little Joy Arcade.
