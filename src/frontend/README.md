# Frontend — shuriken-sdk showcase

The React app for the flagship [`shuriken-sdk`](https://www.npmjs.com/package/shuriken-sdk) demo — an app for **the Metanet social network ([metanet.page](https://www.metanet.page))**.

```bash
npm install
npm run dev          # local dev
npm run typecheck    # tsc --noEmit
npm run check        # biome lint
npm run build        # vite build
```

## Where the SDK integration lives (start here — it's teaching material)

| File | What it teaches |
|---|---|
| `src/contexts/SDKProvider.tsx` | Owns one `shuriken-sdk` client. `connect()` (transport) then `ninja.connect()` (identity); publishes `{ ninja, me, status, error, reconnect }` via `useSDK()`, plus the derived ICP actor. |
| `src/Demo.tsx` | The `#/sdkdemo` showcase — one panel per capability, exercising the whole SDK for **V0 and V1** identities. |
| `src/App.tsx` | Entry point + hash router. `#/` = build-your-app home, `#/sdkdemo` = showcase. |
| `src/lib/icpIdentity.ts` | Turns the connection's `me.icIdentityPackage` into an ICP `DelegationIdentity` (the only correct ICP auth inside the iframe — never Internet Identity). |
| `src/lib/ninjaError.ts` | The error contract: catch `NinjaError`, branch on `err.code`, localize with `t(code)`, treat `ERR_ABORTED` as a silent cancel. |
| `src/components/demo/primitives.tsx` | Pure presentational helpers shared by the panels. |

## The API is the package

Don't guess at methods — the authoritative reference ships inside the installed package:

- `node_modules/shuriken-sdk/llms.txt`
- `node_modules/shuriken-sdk/AGENTS.md`
- `node_modules/shuriken-sdk/manifest.json`

See `../../AI_NOTES.md` for the build guide (happy path + platform hard-rules) and `../../README.md` for the demo overview.

## Non-negotiable platform rules

- Keep `body { padding-top: 70px !important; }` in `src/index.css`.
- Keep `public/logo.jpeg` (square) and `public/cover.jpeg` (landscape).
- Wrap content in `mx-auto max-w-[1000px] px-[10px]`; use `calc(100vh - 70px)` for full-height areas.
- Route external links + clipboard through `ninja.openLink()` / `ninja.clipboard.write()`.
