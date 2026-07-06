/**
 * SDKProvider.tsx — the app's single bridge to the Metanet social network (metanet.page).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS
 *   A thin React context around **shuriken-sdk** (`npm i shuriken-sdk`). It owns
 *   exactly one `Ninja` client and publishes it — plus the normalized identity and
 *   connection state — to the whole tree via `useSDK()`.
 *
 *   shuriken-sdk is the official SDK for apps on the Metanet social network. It does
 *   ALL the hard postMessage work for you: handshake, per-command timeouts, response
 *   correlation, origin allow-list, and — critically — signature-verify-or-reject on
 *   every inbound message. Your app never touches the wire envelope.
 *
 * WHY a provider (and not just `connect()` inline)
 *   `connect()` builds the transport once; `ninja.connect()` establishes the session
 *   verification key. Both should happen once, high in the tree, and the resulting
 *   client + identity shared. This provider does that and cleans up on unmount.
 *
 * THE TWO "connect" CALLS (do not confuse them — the #1 integration trap):
 *   1. `connect(options)`      → INIT/transport. Installs the listener, negotiates
 *                                the protocol, verifies signatures. Returns `ninja`.
 *   2. `ninja.connect(params)` → IDENTITY. Asks "who is the user?" and returns the
 *                                version-discriminated identity (`me`).
 *
 * IDENTITY IS VERSION-DISCRIMINATED (V0 vs V1) — the one thing to get right:
 *   - anonymous → `{ anonymous: true, canonicalId: null }`
 *   - V0 (legacy) → `{ version: 0, wallet: {...}, canonicalId }` (root-key signed)
 *   - V1 (standard) → `{ version: 1, app: { pub }, bsv?/icp?/kda?, proofs, canonicalId }`
 *   Anchor everything on `me.canonicalId` — the ONLY field present on both versions.
 *
 * ICP BACKEND ACTOR
 *   `me.icIdentityPackage` (delivered on the connection response) is turned into a
 *   `DelegationIdentity` here and used to build an authenticated backend actor. This
 *   is how a Metanet app calls its OWN ICP canister — never via Internet Identity,
 *   which is unreachable inside the sandboxed iframe (see lib/icpIdentity.ts).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { DelegationIdentity } from "@icp-sdk/core/identity";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
// The whole public surface comes from ONE import path. `connect` builds the client;
// `NinjaError`/`isNinjaError` let us branch on `.code`; the rest are types.
import {
  type ConnectParams,
  type ConnectResult,
  type Ninja,
  NinjaError,
  connect,
  isNinjaError,
} from "shuriken-sdk";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { buildIcpIdentity } from "../lib/icpIdentity";

/**
 * Connection lifecycle, mirrored from shuriken-sdk/react's `NinjaStatus`:
 *  - `idle`       — before bring-up (and SSR).
 *  - `connecting` — `connect()` and/or the identity handshake in flight.
 *  - `connected`  — a non-anonymous identity was established.
 *  - `anonymous`  — client is up but the user shared no identity (prompt sign-in;
 *                   this is NOT an error).
 *  - `error`      — bring-up failed (e.g. ERR_NOT_EMBEDDED, or the handshake threw).
 */
export type SDKStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "anonymous"
  | "error";

/**
 * Origins the SDK will accept INBOUND messages from (production). Anything else is
 * rejected before it can reach the app — a core security guarantee. In `dev` this
 * list is ignored and localhost is allowed instead (never ship `dev: true`).
 */
const ALLOWED_ORIGINS = [
  "https://www.metanet.page",
  "https://www.metanet.ninja",
];

/**
 * What we request on the identity handshake:
 *  - `request: ['bsv', 'icp']` — share those purpose-scoped identities (V1);
 *    harmless on V0 (ignored). Enables BSV address + ICP principal in `me`.
 *  - `proofs: ['app']`         — also mint the app ZK proof in the SAME consent
 *    overlay. On a V0 user this is simply absent (V0 has no app proof).
 */
const CONNECT_PARAMS: ConnectParams = {
  request: ["bsv", "icp"],
  proofs: ["app"],
};

interface SDKContextValue {
  /** The live shuriken-sdk client, or `null` until built / after teardown. */
  ninja: Ninja | null;
  /** Bring-up + identity state machine. */
  status: SDKStatus;
  /** The version-discriminated identity from `ninja.connect()`, or `null`. */
  me: ConnectResult | null;
  /** The fatal bring-up error, if `status === 'error'`. Always a NinjaError. */
  error: NinjaError | null;
  /** Tear down the client and re-run the whole bring-up (transport + identity). */
  reconnect: () => void;

  // ── ICP convenience (derived from `me.icIdentityPackage`) ──────────────────
  /** ICP delegation identity for authenticated canister calls, or `null`. */
  icIdentity: DelegationIdentity | null;
  /** A backend actor authenticated with `icIdentity`, or `null` if unavailable. */
  actor: backendInterface | null;
}

const SDKContext = createContext<SDKContextValue | null>(null);
SDKContext.displayName = "SDKContext";

/**
 * `useSDK()` — read the context or fail loudly if used outside the provider.
 * The opaque "cannot read property of null" is exactly what this SDK exists to
 * prevent, so we name the missing provider.
 */
export function useSDK(): SDKContextValue {
  const ctx = useContext(SDKContext);
  if (ctx === null) {
    throw new Error(
      "useSDK must be used inside <SDKProvider>. Wrap your tree in <SDKProvider>.",
    );
  }
  return ctx;
}

/**
 * `<SDKProvider>` — owns the single Ninja client and the derived ICP actor.
 *
 * Lifecycle:
 *   1. Mount effect calls `connect({ allowedOrigins, dev })` (INIT). On failure
 *      (e.g. ERR_NOT_EMBEDDED when opened standalone) → `status: 'error'`.
 *   2. Then `ninja.connect(CONNECT_PARAMS)` (IDENTITY). Store `me`; move to
 *      `connected` (identity shared) or `anonymous` (none shared).
 *   3. From `me.icIdentityPackage`, build the ICP `DelegationIdentity` and, from it,
 *      an authenticated backend actor.
 *   4. On unmount / reconnect, `ninja.disconnect()` (rejects pending calls, removes
 *      the window listener). No orphaned clients.
 */
export function SDKProvider({ children }: { children: ReactNode }) {
  const [ninja, setNinja] = useState<Ninja | null>(null);
  const [status, setStatus] = useState<SDKStatus>("idle");
  const [me, setMe] = useState<ConnectResult | null>(null);
  const [error, setError] = useState<NinjaError | null>(null);
  const [icIdentity, setIcIdentity] = useState<DelegationIdentity | null>(null);
  const [actor, setActor] = useState<backendInterface | null>(null);

  // Bumped by `reconnect()` to force the bring-up effect to run again from scratch.
  const [nonce, setNonce] = useState(0);
  const reconnect = useCallback(() => {
    setError(null);
    setMe(null);
    setIcIdentity(null);
    setActor(null);
    setStatus("idle");
    setNonce((n) => n + 1);
  }, []);

  // ── Bring-up: connect() (transport) → ninja.connect() (identity) ────────────
  // `nonce` is intentionally the only dependency: reconnect() bumps it to force a
  // full teardown + rebuild. The effect reads no other reactive value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce is the manual re-run trigger.
  useEffect(() => {
    // SSR / non-browser guard: no parent window to talk to; do nothing.
    if (typeof window === "undefined") return;

    let cancelled = false;
    let built: Ninja | null = null;
    setStatus("connecting");

    (async () => {
      try {
        // 1. INIT. `dev: import.meta.env.DEV` relaxes the origin gate to localhost
        //    ONLY during local dev; in production ALLOWED_ORIGINS is enforced.
        const client = await connect({
          allowedOrigins: ALLOWED_ORIGINS,
          dev: import.meta.env.DEV,
        });
        if (cancelled) {
          client.disconnect();
          return;
        }
        built = client;
        setNinja(client);

        // 2. IDENTITY. This establishes the session verification key; every later
        //    response is signature-checked against it before it resolves.
        const result = await client.connect(CONNECT_PARAMS);
        if (cancelled) return;
        setMe(result);
        setStatus(result.anonymous ? "anonymous" : "connected");

        // 3. Derive the ICP delegation identity (present on both V0 and V1 when the
        //    platform issued one). A missing package just means no ICP actor.
        const del = buildIcpIdentity(result.icIdentityPackage);
        if (cancelled) return;
        setIcIdentity(del);
      } catch (err) {
        if (cancelled) return;
        // Normalize to NinjaError so `useSDK().error` is always typed + localizable
        // via `t(error.code)`. Wrap anything unexpected.
        const nerr = isNinjaError(err)
          ? err
          : new NinjaError("ERR_UNKNOWN", {
              method: "connection",
              hint: "shuriken-sdk bring-up failed unexpectedly.",
              cause: err,
            });
        setError(nerr);
        setStatus("error");
      }
    })();

    // Cleanup: dispose whatever this run built (rejects pending calls with
    // ERR_DISCONNECTED and removes the transport listener).
    return () => {
      cancelled = true;
      if (built) built.disconnect();
      setNinja(null);
    };
  }, [nonce]);

  // ── Authenticated backend actor from the ICP delegation ─────────────────────
  // Rebuilt whenever the delegation changes. Uses the app's existing createActor
  // wiring (config.ts), just fed the DelegationIdentity from the Metanet connection
  // instead of an Internet Identity — the ONLY correct auth source in this iframe.
  useEffect(() => {
    if (!icIdentity) {
      setActor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const built = await createActorWithConfig({
          agentOptions: { identity: icIdentity },
        });
        if (!cancelled) setActor(built);
      } catch {
        // A backend that isn't configured (env.json placeholders) must not break the
        // SDK demo — leave the actor null; the ICP panel simply reports unavailable.
        if (!cancelled) setActor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [icIdentity]);

  const value = useMemo<SDKContextValue>(
    () => ({ ninja, status, me, error, reconnect, icIdentity, actor }),
    [ninja, status, me, error, reconnect, icIdentity, actor],
  );

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}

/**
 * `useNinja()` — the raw client (or `null` pre-connect). Convenience for panels that
 * only need to fire calls (`ninja.pay.bsv(...)`, `ninja.tx.get(...)`, …).
 */
export function useNinja(): Ninja | null {
  return useSDK().ninja;
}

/** A ref for panels that want an imperative, always-current handle to the client. */
export function useNinjaRef(): { current: Ninja | null } {
  const ninja = useNinja();
  const ref = useRef<Ninja | null>(ninja);
  ref.current = ninja;
  return ref;
}
