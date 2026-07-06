# shuriken-sdk — flagship demo

This is the **flagship showcase** for [`shuriken-sdk`](https://www.npmjs.com/package/shuriken-sdk), the official SDK for building apps on **the Metanet social network ([metanet.page](https://www.metanet.page))**.

A Metanet app runs in a sandboxed `<iframe>` and talks to the platform over a signed `postMessage` protocol. `shuriken-sdk` is the one typed, signature-verifying bridge that does all of it — identity, BSV/ICP/KDA payments, feed posts, ZK proofs, transactions, geolocation, QR — so your app is a few lines.

```bash
npm i shuriken-sdk
```

## What this demo shows

A single polished page (`#/sdkdemo`) that exercises **every** `shuriken-sdk` capability, split so **both identity versions (V0 and V1)** are visible side by side:

1. **Init + connect** — `connect()` (transport, signature verification) then `ninja.connect()` (identity), with a live status pill and reconnect.
2. **Identity** — the version-discriminated identity: an Anonymous state, a **V0** branch (`me.wallet.*`, root-key signed) and a **V1** branch (`me.app.pub` + `me.bsv?/icp?/kda?` + proofs), always anchored on `me.canonicalId`. `me.genericUseSeed` is shown masked (arrives on both versions).
3. **Payments** — `pay.bsv` with a broadcast toggle (`true` → txid; `false` → authorized `rawTxHex` + a "Broadcast now" button calling `broadcastRawTx(rawTxHex, me.genericUseSeed)`), `pay.icp` by token **name** (dropdown from `ninja.tokens`), `pay.kda`.
4. **Feed** — `feed.createPost({ headline, previewAsset })` with a file input.
5. **Proofs** — `proof.generate()` + `identity.verifyProof(...)`, including the `app_proof_requires_v1` fallback for V0.
6. **Transactions** — `tx.get(txid)` and `tx.history({ chain, limit })`.
7. **Streams** — `geo.current()` + a live `geo.watch()` feed with Stop; `qr.scan(cb)` with Stop.
8. **Utilities** — `openLink(url)` (consent-gated), `clipboard.write(text)` (fire-and-forget).
9. **Uniform core + introspection** — `ninja.call(method, params)` and `ninja.capabilities()` / `ninja.protocol`.

Every action surfaces `NinjaError.code` on failure (localize with your own `t(code)`), and treats `ERR_ABORTED` as a silent user cancel.

There is also a bonus **ICP backend** panel: the authenticated canister actor is built from the connection's `me.icIdentityPackage` → `DelegationIdentity` (never Internet Identity, which is unreachable inside the iframe).

## Run it

```bash
cd src/frontend
npm install
npm run dev        # or: npm run build && npm run preview
```

The SDK is consumed as the published package `shuriken-sdk` (`^0.1.0`). Open the app from within metanet.page (or a dev host) so it has a parent window to talk to — opened standalone it reports `ERR_NOT_EMBEDDED`, which is correct.

## Where the truth lives

- The SDK's own **`llms.txt`** and **`AGENTS.md`** (shipped inside the npm package) are the authoritative, task-oriented API reference — read those to build, don't invent methods.
- `AI_NOTES.md` in this folder is the AI build guide (connect → identity → pay → post happy path + the platform hard-rules).
- The demo's SDK-integration code is heavily commented as teaching material — start at `src/frontend/src/contexts/SDKProvider.tsx` and `src/frontend/src/Demo.tsx`.

> This demo was seeded from a Caffeine export and rebuilt onto `shuriken-sdk`. The old bespoke per-app client (the legacy bespoke ninja SDK) is gone; there is nothing to hand-copy anymore.
