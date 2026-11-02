# Level format

Levels are stored in `src/data/levels.json`, a versioned manifest imported by the game and the tests.

## Manifest

```json
{
  "format": 1,
  "generator": "bus-jam-bonanza/bake-v1",
  "levels": [ /* 300 entries */ ]
}
```

## Level

```json
{
  "id": "level-001",
  "world": 1,
  "index": 0,
  "name": "Sunny Stop",
  "width": 6,
  "height": 4,
  "bays": 3,
  "queue": ["red", "blue", "red"],
  "buses": [
    {
      "id": "b1",
      "color": "yellow",
      "capacity": 6,
      "position": { "x": 0, "y": 2 },
      "direction": "east",
      "length": 2
    }
  ],
  "barriers": [{ "x": 4, "y": 2, "opensAfter": 1 }],
  "obstacles": [],
  "difficulty": 6.1,
  "par": 3,
  "solution": ["b2", "b1", "b3"],
  "explored": 412,
  "seed": "2054763312:0",
  "version": 1
}
```

| Field | Meaning |
| --- | --- |
| `id` | `level-001` … `level-300`, stable save key. |
| `world`, `index` | World 1–10, zero-based index inside the world. |
| `width`, `height` | Logical grid size in cells. |
| `bays` | Number of boarding bays (1–6; campaign uses 3–5). |
| `queue` | Ordered passenger colours; front is index 0. |
| `buses[].position` | Rear cell; the footprint extends along `direction`. |
| `buses[].capacity` | 4, 6, 8 or 12; must match `length` 2 or 3. |
| `barriers` | Gate cells and the number of departures needed to open them. |
| `obstacles` | Solid cells (supported, unused by the shipped campaign). |
| `difficulty` | 1–10 signal from the generator, not a star threshold. |
| `par` | Minimum dispatch count found by the solver. |
| `solution` | Verified dispatch order, replayed by tests. |
| `explored` | States explored when the solution was found. |
| `seed` | Generation seed and attempt, for audit and reproducibility. |
| `version` | Format version, currently 1. |

## Validation rules

`src/core/validate.ts` fails a level when:

- ids are missing or duplicated, or world/index are out of range;
- width/height are outside 3–14, or bays are outside 1–6;
- a bus leaves the board, overlaps another bus, or has a capacity/length mismatch;
- a colour is not in the eight-colour palette;
- a barrier or obstacle sits under a bus, or `opensAfter < 1`;
- a colour has more passengers than seats, or total seats are below the queue length;
- the initial state is already won, or the solution is empty;
- replaying `solution` through `dispatchBus` does not reach victory;
- `par` differs from `solution.length`.

The campaign test runs all of these plus a full `replaySolution` for all 300 levels, and an independent solver run
on a broad sample. `npm run validate` performs the same checks outside Vitest.

## Editing a level by hand

1. Edit the JSON or a generator template.
2. Run `npm run validate` — it reports the level id and the exact failure.
3. If you change a solution, run the solver (`solver.ts`) to obtain a new verified `solution`/`par`, or
   `npm run bake` to regenerate deterministically.
4. Never ship a hand-written level whose `solution` has not been replayed.

## Versioning

- `format` is the manifest shape; `version` is per-level content.
- A breaking change to the engine that alters solvability requires bumping the generator version and re-baking.
- Save data stores level ids, so ids must remain stable. If a level must be replaced, add a new id rather than
  reusing it.
- The bake script is deterministic; a diff in `levels.json` after a code change is a reviewable signal of exactly
  which puzzles changed.
