# Deployment

## Build

```bash
npm ci
npm run validate   # 300 levels + replayed solutions
npm test           # Vitest suites
npm run build      # tsc --noEmit && vite build
```

`vite.config.ts` sets `base: './'` so the same `dist/` works at a project path
(`jd4rider.github.io/bus-jam-bonanza/`), at the `/play/` sub-path used by the catalogue, and at a custom domain
root.

## GitHub Pages

`.github/workflows/pages.yml` runs validate, tests and build on every push to `main`, copies the playable build to
`dist/play/`, then publishes `dist/` with the official Pages actions. The same layout is used by the other Little
Joy Arcade games.

Expected URLs:

- `https://jd4rider.github.io/bus-jam-bonanza/` — project root
- `https://jd4rider.github.io/bus-jam-bonanza/play/` — playable copy
- `https://busjambonanza.littlejoyarcade.site/play/` — planned production subdomain

## Custom subdomain

DNS and the Pages custom domain are **not** changed by this repository. To activate the production URL, the
platform operator adds a CNAME for `busjambonanza` pointing at `jd4rider.github.io`, sets the Pages custom domain
to `busjambonanza.littlejoyarcade.site`, and waits for GitHub to issue the certificate. Until then the
`github.io` build remains the canonical play URL. Do not add `public/CNAME`: the other game repos deliberately
omit it so the embedded player probe and custom-domain redirect do not break.

## Asset and cache notes

- All art and audio are generated at runtime; there are no sprite/audio fetches to cache.
- `phaser` is bundled into one JS file (~1.9 MB, ~395 kB gzip). A future optimisation is to split the game scene
  from the menu shell; it is not required for first release.
- `arcade-client.js` is copied from `public/` and is the only optional network feature.
- The service worker is intentionally absent; offline play still works because the HTML/JS are CDN-cached and saves
  are local. A proper offline shell can be added later.

## Release checklist

1. `npm run validate`, `npm test`, `npm run build` all green.
2. Playwright smoke test passes on desktop and a phone-sized viewport.
3. Confirm the build boots with the network disabled after the first load.
4. Confirm guest play, then sign in through the arcade client and confirm a cloud save round-trip.
5. Confirm `adsAllowed()` is false for the ad-free entitlement and no ad markup exists in the build.
6. Tag the release and attach a zip of `dist/` if a desktop wrapper is added later.
7. Only then point the subdomain at the Pages site.

## Rollback

Pages keeps the previous successful deployment in the environment history. If a release breaks, re-deploy the
previous commit through the Pages UI or revert the commit on `main` and let the workflow republish. Save keys are
versioned and never need to be cleared for a rollback.
