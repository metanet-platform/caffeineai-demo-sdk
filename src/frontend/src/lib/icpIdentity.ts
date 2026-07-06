/**
 * icpIdentity.ts — turn the Metanet connection's `icIdentityPackage` into an
 * authenticated ICP `DelegationIdentity` (for calling your own backend canister).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT this is
 *   `shuriken-sdk`'s `ninja.connect()` resolves a normalized identity that also
 *   carries `me.icIdentityPackage` — a time-bounded ICP delegation the platform
 *   minted for THIS app. That package is an opaque wire object; this helper is
 *   the ONE place that reconstructs it into a `@dfinity` `DelegationIdentity` you
 *   can hand to an `HttpAgent`.
 *
 * WHY it lives outside the SDK
 *   `shuriken-sdk` is deliberately zero-dependency and chain-agnostic: it delivers
 *   the raw `icIdentityPackage` and stays out of the `@dfinity/*` business. Turning
 *   that package into a usable ICP identity needs the @dfinity libraries, so it is
 *   the APP's job — kept here, isolated, so the rest of the demo just consumes a
 *   ready `DelegationIdentity`.
 *
 * WHY this pattern (and not Internet Identity)
 *   Internet Identity is NOT reachable from a sandboxed iframe on the Metanet
 *   social network (metanet.page). The platform is the identity authority: it hands
 *   the app a delegation via the connection response. So an ICP-backed Metanet app
 *   builds its authenticated actor from THIS delegation — never from AuthClient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  DelegationChain,
  DelegationIdentity,
  Ed25519KeyIdentity,
} from "@icp-sdk/core/identity";

/**
 * The shape of `me.icIdentityPackage` as the platform sends it.
 *
 * - `privateKey` — hex of the delegatee's Ed25519 secret key (the app-scoped key
 *   the platform generated; it signs ICP calls under the delegation). This is a
 *   time-bounded, app-scoped key — NOT the user's root key — so it is safe to
 *   materialize here for the session.
 * - `delegation` — the signed delegation chain (JSON) proving the platform
 *   authorized `privateKey` to act for the user's principal.
 */
export interface IcIdentityPackage {
  privateKey: string;
  delegation: unknown;
}

/** Decode a hex string (no 0x prefix) into bytes. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Type guard: does this look like a real `icIdentityPackage`?
 *
 * WHY narrow first: `me.icIdentityPackage` is typed `unknown` by the SDK (it is an
 * opaque envelope extra). We refuse to build an identity from a malformed package
 * rather than throwing deep inside @dfinity — a missing package simply means "this
 * user/version didn't get an ICP delegation", which the caller handles gracefully.
 */
export function isIcIdentityPackage(pkg: unknown): pkg is IcIdentityPackage {
  return (
    typeof pkg === "object" &&
    pkg !== null &&
    typeof (pkg as { privateKey?: unknown }).privateKey === "string" &&
    (pkg as { delegation?: unknown }).delegation != null
  );
}

/**
 * Build an ICP `DelegationIdentity` from the connection's `icIdentityPackage`.
 *
 * Steps (byte-for-byte the platform's expected construction):
 *   1. `Ed25519KeyIdentity.fromSecretKey(privateKeyBytes)` — the delegatee inner key.
 *   2. `DelegationChain.fromJSON(delegation)` — the signed authorization chain.
 *   3. `DelegationIdentity.fromDelegation(inner, chain)` — the usable identity.
 *
 * @returns the `DelegationIdentity`, or `null` if the package is absent/malformed
 *          (e.g. an anonymous user, or a build with no ICP delegation issued).
 */
export function buildIcpIdentity(pkg: unknown): DelegationIdentity | null {
  if (!isIcIdentityPackage(pkg)) return null;
  try {
    const inner = Ed25519KeyIdentity.fromSecretKey(hexToBytes(pkg.privateKey));
    const chain = DelegationChain.fromJSON(
      pkg.delegation as Parameters<typeof DelegationChain.fromJSON>[0],
    );
    return DelegationIdentity.fromDelegation(inner, chain);
  } catch {
    // A malformed package is not fatal to the app — the ICP actor simply stays
    // unavailable. Callers surface "ICP identity unavailable" rather than crash.
    return null;
  }
}
