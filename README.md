# Digital PT

A client-only PWA for one person's gym training: an exercise library, a daily checklist and
rule-based session suggestions. Swedish UI, no backend, all data in IndexedDB on the phone.
The product spec is in `SPEC.md`.

## Develop

```sh
npm install
npm run dev        # dev server (install gate bypassed on localhost via ?debug=1)
npm test           # unit tests (engine, catalog search, backup round trip)
npm run build      # builds the catalog, typechecks and bundles to dist/
npm run preview    # serves dist/ locally
```

The install gate hides the app when it is not running from the Home Screen. For desktop
testing open the app with `?debug=1` once; the bypass is remembered for the browser session.

## Layout

- `src/engine/` – pure rules engine (dates, group status, suggestions, hints) with tests.
- `src/config/` – muscle groups and the constants from SPEC.md section 5.
- `src/strings.ts` – every UI string (Swedish).
- `src/db/` – Dexie database, helpers, backup export/import and schema migrations.
- `src/catalog/` – catalog loader and search; `catalog.generated.json` is built, not committed.
- `src/ui/` – React screens and components.
- `catalog/source.json` – the exercise catalog source of truth (fine anatomical tags).
- `catalog/mapping.json` – maps fine tags to her muscle groups.
- `scripts/build-catalog.mjs` – validates the source and writes the shipped catalog.
- `scripts/make-icons.mjs` – regenerates the PNG icons from an inline SVG.

## Deploy (Netlify)

The site is deployed from git. In Netlify: *Add new site → Import an existing project*, pick
this repository. `netlify.toml` already sets the build command (`npm run build`), the publish
directory (`dist`), the SPA redirect and no-cache headers for `sw.js`, the manifest and
`index.html`. Every push to `main` deploys.

Updates reach an installed phone automatically: the service worker uses skip-waiting and
claims clients, the register helper reloads when a new worker activates, and the app checks for
a new worker every time it comes to the foreground.

## Install on iPhone

Open the deployed URL in Safari, tap *Dela* and choose *Lägg till på hemskärmen*. Open the app
from the Home Screen; the first run asks for persistent storage and lets her pick exercises
from the catalog. Diagnostics live under *Inställningar → Om appen* and can be copied as text.
