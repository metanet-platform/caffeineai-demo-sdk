# AI build guide — building a Metanet app with shuriken-sdk

> **READ THIS FIRST.** This is an app for **the Metanet social network ([metanet.page](https://www.metanet.page))**. It runs in a sandboxed iframe and talks to the platform through the official SDK, **`shuriken-sdk`**.

## The one instruction that matters

To build a Metanet social-network app, install the SDK:

```bash
npm i shuriken-sdk
```

Then read the SDK's own docs — they ship **inside the package** and are the authoritative source of truth for every method. Do not invent methods; the surface is closed (12 methods).

- **`node_modules/shuriken-sdk/llms.txt`** — a flat, anchored index built for LLMs.
- **`node_modules/shuriken-sdk/AGENTS.md`** — a task-oriented playbook (with the V0/V1 identity trap called out up top).
- **`node_modules/shuriken-sdk/manifest.json`** — machine-readable schemas for every method, error code, consent + streaming flag.
- At runtime, **`ninja.capabilities()`** returns the live manifest.

Everything below is the minimum you need; the files above are the full reference.

## The happy path (connect → identity → pay → post)

```ts
import { connect, NinjaError } from "shuriken-sdk";

// 1. INIT: build the transport, negotiate the protocol, verify every signature.
const ninja = await connect({
  allowedOrigins: ["https://www.metanet.page", "https://www.metanet.ninja"],
  dev: import.meta.env.DEV,          // localhost ONLY — never ship `true`
});

// 2. IDENTITY: who is the user? (normalized across identity versions)
const me = await ninja.connect({ request: ["bsv", "icp"], proofs: ["app"] });

// 3. Use it. Everything anchors on me.canonicalId.
if (me.anonymous) {
  showLoginNudge();
} else {
  await ninja.pay.bsv([{ address: me.bsv?.address, sats: 5000 }]); // broadcasts by default
  await ninja.feed.createPost({ headline: "gm" });
}
```

`connect()` (init/transport) and `ninja.connect()` (identity) are **different calls** — do the first, then the second.

## The two identity versions (the #1 correctness trap)

`ninja.connect()` returns one of three shapes, discriminated on `version`:

- `{ anonymous: true, canonicalId: null }` — no user connected.
- `{ version: 0, wallet: { publicKeyHex, address, … }, canonicalId }` — **V0, legacy.** One wallet object; responses are root-key signed.
- `{ version: 1, app: { pub }, bsv?, icp?, kda?, proofs, canonicalId }` — **V1, standard.** Purpose-scoped keys; responses are signed with the app-specific key `app.pub`.

Rules:

1. **Anchor all user data on `me.canonicalId`** — the only field present on both versions. Never key on `wallet.address` or `bsv.address`.
2. **Branch before you read.** Never touch `me.wallet.*` without `if (me.version === 0)`, nor `me.bsv/icp/kda/app` without `if (me.version === 1)`. TypeScript enforces this.
3. **No fallback chains** (`wallet || identities`). The version selects exactly one shape.

`me.genericUseSeed` arrives on **both** versions — a fixed per-user-per-app seed the SDK keeps in-session and uses to sign BSV broadcasts, so you rarely touch it.

## Capability cheat-sheet

| Task | Call |
|---|---|
| Identify the user | `await ninja.connect({ request: ['bsv'] })` |
| BSV payment (broadcasts by default) | `await ninja.pay.bsv([{ address, sats }])` → `{ txid, rawTxHex }` |
| BSV authorize-only | `ninja.pay.bsv(r, { broadcast: false })` → `rawTxHex`; finalize via `broadcastRawTx(rawTxHex, me.genericUseSeed)` |
| ICP payment (single recipient) | `ninja.pay.icp({ token: 'ckUSDC', to, amount })` — token by name via `ninja.tokens` |
| KDA payment (single recipient) | `ninja.pay.kda({ to, amount })` |
| Post to the feed | `ninja.feed.createPost({ headline, previewAsset })` → `{ postId }` |
| Prove identity (ZK) | prefer `ninja.connect({ proofs: ['app'] })`; standalone `ninja.proof.generate({ reason })` (V0 → `app_proof_requires_v1`) |
| Verify a peer's proof | `ninja.identity.verifyProof(proof, canonicalId)` |
| Fetch a tx for SPV | `ninja.tx.get(txid)` → `{ rawHex, bumpHex }` |
| Tx history | `ninja.tx.history({ chain, limit })` |
| Location | one-shot `ninja.geo.current()`; stream `for await (const f of ninja.geo.watch()) { if (f.isFinal) break; }` |
| QR | `const s = ninja.qr.scan(({ rawValue }) => {}); s.stop();` |
| Open a link | `await ninja.openLink(url)` (consent-gated) |
| Clipboard | `ninja.clipboard.write(text)` (fire-and-forget, no response) |
| Any method / forward-compat | `ninja.call(method, params)` |

ICP/KDA payments are **single recipient** only. App ZK proofs require a **V1** identity.

## Errors — branch on code, localize with t(code)

Every failure is a `NinjaError` with a machine `.code` (a closed union). Never string-match the message.

```ts
try {
  await ninja.pay.bsv([{ address, sats: 5000 }]);
} catch (e) {
  if (e instanceof NinjaError) {
    if (e.code === "ERR_ABORTED") return;   // user cancelled — do NOT surface
    toast(t(e.code));                        // localize by code
  } else throw e;
}
```

Common codes: `ERR_ABORTED` (user cancel), `ERR_UNSUPPORTED_TOKEN`, `ERR_MULTIPLE_RECIPIENTS`, `user_denied`, `app_proof_requires_v1`, `invalid_salt`, `ERR_TIMEOUT` (retriable), `ERR_SIGNATURE` (never trust the payload), `ERR_NOT_EMBEDDED` (opened outside an iframe).

## React

```tsx
import { NinjaProvider, useConnection, usePayment } from "shuriken-sdk/react";
// Hooks: useConnection, usePayment, useGeolocation, useQrScanner, useNinja.
```

This demo wraps its own thin `<SDKProvider>` (in `src/frontend/src/contexts/SDKProvider.tsx`) so it can additionally build the ICP backend actor from `me.icIdentityPackage`. For a plain app, `shuriken-sdk/react`'s `NinjaProvider` + hooks are enough.

## ICP backend calls

If your app has its own ICP canister, build the authenticated actor from the connection's `me.icIdentityPackage` → `DelegationIdentity` (see `src/frontend/src/lib/icpIdentity.ts`). **Never** use Internet Identity / `AuthClient` — it is unreachable inside the sandboxed iframe. The platform is the identity authority.

---

## Platform hard-rules (never remove — these break the app if dropped)

These are non-negotiable requirements of every metanet.page iframe app. They are also embedded in the deployed showcase UI so they survive an AI remix that deletes this file.

- **70px top padding.** Keep `body { padding-top: 70px !important; }` in `src/frontend/src/index.css`. The platform renders a fixed top nav bar that overlaps the iframe; without the padding, the top of your app is hidden.
- **Page height.** Use `calc(100vh - 70px)` (Tailwind `min-h-[calc(100vh-70px)]`), never bare `100vh`, or the bottom overflows behind the nav bar. Subtract any of your own fixed sub-nav heights too.
- **Required images.** Keep `src/frontend/public/logo.jpeg` (square icon) and `cover.jpeg` (landscape). The platform uses them for the app listing. Regenerate to match your branding.
- **Layout container.** Wrap content in `mx-auto max-w-[1000px] px-[10px]`. Be fully responsive (test 375 / 768 / 1280px).
- **Navigation.** Prefer a footer nav (with `env(safe-area-inset-bottom)` for iOS; add `viewport-fit=cover` to the viewport meta). Otherwise a fixed sub-nav at `top: 65px` (flush) or `70px` (5px gap).
- **navbg.** Pass a `navbg` hint on `ninja.connect({ navbg })` to tint the parent nav bar to match your theme.
- **Everything through the SDK.** In the iframe, direct `window.open`/`window.location` navigation and `navigator.clipboard` do not work — use `ninja.openLink()` / `ninja.clipboard.write()`.

## New-app checklist

- [ ] `npm i shuriken-sdk`; read its `llms.txt` + `AGENTS.md`.
- [ ] `connect()` once, then `ninja.connect()` for identity; anchor on `me.canonicalId`.
- [ ] Branch on `me.version`; never mix V0 `wallet` and V1 purpose-key fields.
- [ ] Catch `NinjaError`, branch on `err.code`, localize with `t(code)`; treat `ERR_ABORTED` as a silent cancel.
- [ ] Keep the 70px padding, the two images, and the `max-w-[1000px] mx-auto px-[10px]` container.
- [ ] Use `calc(100vh - 70px)` for full-height areas.
- [ ] Route external links + clipboard through the SDK.
- [ ] For ICP backend calls, build the actor from `me.icIdentityPackage` — never Internet Identity.
