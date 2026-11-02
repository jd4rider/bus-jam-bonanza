# Testing

## Commands

```bash
npm run typecheck   # tsc --noEmit, strict
npm test            # Vitest, 40 tests
npm run validate    # all 300 levels, replay every solution + sampled solves
npm run e2e         # Playwright; needs npx playwright install chromium once
npm run build       # typecheck + production bundle
```

## Vitest suites

| File | Covers |
| --- | --- |
| `tests/engine.test.ts` | footprints, swept route blocking, bay reservations, strict queue order, lowest-bay priority, capacity, departures, gates, obstacles, deadlock vs temporary block, state cloning and hashing |
| `tests/solver.test.ts` | known solvable campaign level, hand-built unsolvable jam, budget exhaustion → UNKNOWN, illegal replay rejection, solving from a mid-level state |
| `tests/generator.test.ts` | deterministic seeds, no overlaps, replayable late-world solutions, distinct early stops, exact seat balance, all capacity classes, stable ids |
| `tests/campaign.test.ts` | 300 levels, ten worlds of 30, unique ids/names, full schema/geometry/capacity validation, replay of every solution, sampled independent solves with truthful par, no pre-solved starts, difficulty trend, surplus and gate coverage, seed metadata |
| `tests/saves.test.ts` | corrupt save sanitising, clamping, round-trip, conservative cloud merge, star rules, completion/unlock/achievement banking, session save/load/clear |

The campaign test fails the build if any shipped level is invalid, if a recorded solution cannot be replayed, or
if a sampled level's par is not the solver optimum. There is no “skip” path.

### Last verified run

- `tsc --noEmit` — pass.
- `vitest run` — 5 files, 40 tests, all pass (~1.4 s).
- `npm run build` — pass, single bundle ~1.94 MB / 395 kB gzip.
- `npm run validate` — pass for all 300 levels; 30 sampled solves verified.
- `playwright test` — 4 tests pass across desktop-chrome and mobile-chrome (iPhone 13 emulation), 33.5 s. The run exercises boot, real menu click, a legal bus dispatch, pause/resume, a viewport/orientation restart with conserved moves, a reload with session recovery, and two portrait layouts with zero uncaught page errors.

### Regression caught by the browser test

The first Playwright run found a real input bug: Phaser Containers use a centred display origin for hit testing, while the menu buttons are drawn from their top-left. Clicks near the right half of a button missed. The interactive rectangles now compensate (`button`, `iconButton`, bus visuals and level cards), and the suite clicks the centre of the real Start button and a real bus. This is why the browser test is part of the release gate.

## Playwright

`playwright.config.ts` starts Vite on `127.0.0.1:5174` and runs two projects:

- **desktop-chrome** — default desktop viewport;
- **mobile-safari** — iPhone 13 device profile (Chromium execution).

`tests/e2e/game.spec.ts`:

1. boots the game and waits for the Menu scene;
2. clicks the real Continue button using its design-space coordinates;
3. confirms the Game scene loaded level-001;
4. clicks a real bus container and waits for the dispatch animation;
5. checks the move counter, undo history and the saved session key;
6. pauses and resumes with Escape;
7. resizes to a landscape viewport and confirms the scene restarts in landscape with its state intact;
8. reloads and confirms the local save key exists, while collecting any page errors;
9. a second test loads a 390 px portrait viewport and asserts the portrait layout and board model.

The tests assert zero uncaught page errors. They do not exhaustively click every UI element.

## What is not covered

- WebKit and Firefox browser engines (the mobile project uses Chromium emulation).
- Real device testing for haptics or iOS audio unlocking.
- Network cloud-save round trips, because they require live Supabase credentials and a signed-in account.
- Advertisement/entitlement rendering, because no ad surface is active.
- Visual pixel comparisons; the game is drawn procedurally and small art changes are expected.
- Load testing of the solver on adversarial hand-written boards beyond the shipped campaign.

Report these as limitations, never as passes.
