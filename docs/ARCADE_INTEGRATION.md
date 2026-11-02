# Little Joy Arcade integration

The game follows the platform convention used by the other Phaser titles in this workspace. The platform SDK
source lives in `littlejoyarcade/packages/sdk`; the production games use the **plain drop-in client** instead of a
build-time dependency so a game can ship independently.

## What is wired up

`index.html` loads:

```html
<script src="./arcade-client.js" data-game-id="bus-jam-bonanza"></script>
```

`public/arcade-client.js` is the platform's drop-in client. When platform env is configured it:

- offers sign-in / create-account UI;
- mirrors the game's Web Storage keys into one `game_progress` row per player;
- restores the newest snapshot on a fresh device and reloads once;
- queues writes when offline and re-syncs on focus/online/interval.

Nothing in the game requires the client to be present. With no network, no account or blocked storage, the game
boots and saves locally.

## Local save contract

| Key | Contents |
| --- | --- |
| `bus-jam-bonanza-save-v1` | versioned progress: completed levels, stars, best moves, achievements, settings, unlocks, daily results, endless best, stats |
| `bus-jam-bonanza-session-v1` | current level id, engine state, moves, hints, mode and daily/endless coordinates |
| `lja:<game>:*` | owned by the arcade client, never read or written by the game |

`src/core/saves.ts` sanitises every loaded value, clamps numbers, drops unknown shapes and rebuilds a clean
`Progress`. `mergeProgress(local, cloud)` implements the conservative merge rule: highest stars, fewest moves,
union of achievements, furthest unlock, best stats. A stale cloud copy cannot erase local progress.

## Adapter

`src/core/arcade.ts` wraps the optional global:

```ts
arcade.available()   // client present and configured
arcade.userLabel()   // signed-in email or Guest player
arcade.status()      // platform sync status text
arcade.sync()        // request a flush
arcade.openArcade()  // return to https://littlejoyarcade.site
arcade.adsAllowed()  // reads the local entitlement cache
```

The Settings screen shows account state and offers “Open Little Joy Arcade” and “Sync now”.

## Achievements

Ten achievements are defined in `src/core/achievements.ts` and tracked locally, because the drop-in client does
not expose the SDK's achievement API. They are cosmetic and never gate content. The SDK package
(`@littlejoyarcade/sdk`) supports `arcade.achievements.unlock(slug)`; wiring that requires either publishing the
package or copying its source into a future integration step. The current implementation is honest local-only.

## Entitlements and monetization readiness

Entitlements are read from the client's local cache only. The browser can never grant one; grants are server-side
in the platform. `adsAllowed()` returns false when `arcade.ad_free` or `bus-jam-bonanza.ad_free` is present.

There is **no ad surface and no payment flow** in this build. Intended slugs, matching platform conventions:

- `arcade.ad_free`
- `busjambonanza.ad_free`
- `busjambonanza.premium_themes`
- `busjambonanza.cosmetic_pack_1`

Rules for a future implementation: never interrupt an active puzzle with an ad; always call `adsAllowed()` before
rendering a slot; keep all progression playable without purchases; verify premium entitlements through trusted
server code, never a local flag.

## Cloud save behaviour

The drop-in client's snapshot model means the game does not call a network API directly. If a future build adopts
the npm SDK (`createArcade` + `createSupabaseCloud`), hydrate the existing save shape with `progress.load()`, save
where `saveProgress` runs today, and use `mergeProgress` for the merge. Do not invent endpoints.

## Integration checklist

1. `data-game-id="bus-jam-bonanza"` matches the catalogue id.
2. `npm run build` copies `arcade-client.js` into `dist/` (Vite copies `public/`).
3. Guest play works with the script removed.
4. Signed-in sync works: save locally, sign in on another device, confirm restore and one reload.
5. Offline: clear network, finish a level, confirm local save survives, reconnect, confirm sync.
6. Entitlement read: set `lja:entitlements` to `["arcade.ad_free"]` and confirm `adsAllowed()` is false.
7. Return-to-arcade opens `https://littlejoyarcade.site` in a new tab.
