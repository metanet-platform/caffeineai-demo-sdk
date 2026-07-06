/**
 * ninjaError.ts — one place to turn any thrown error into a display-ready result.
 *
 * WHY: every shuriken-sdk call rejects with a `NinjaError` carrying a machine
 * `.code` (a closed union). The rules are always the same:
 *   - `ERR_ABORTED` = the user cancelled a consent overlay. That is NOT an error to
 *     surface — treat it as a silent no-op.
 *   - Everything else: show a LOCALIZED message via `t(code)` (never string-match
 *     the message), and keep `code`/`hint` for debugging.
 * This helper encodes that contract once so every panel handles failures identically.
 */

import { type NinjaError, isNinjaError } from "shuriken-sdk";

/** Outcome of running an SDK action, ready to render. */
export type ActionResult =
  | { kind: "aborted" } // user cancelled — render nothing / a subtle note
  | { kind: "error"; code: string; message: string; hint?: string }
  | { kind: "ok"; message: string; data?: unknown };

/**
 * A minimal stand-in for a real i18n `t(code)`. In a production Metanet app you'd
 * wire these codes into your locale files (12 languages on metanet.page). Here we
 * ship friendly English fallbacks keyed by the SDK's closed error-code union so the
 * demo shows the RIGHT pattern: localize by code, not by message text.
 */
const CODE_MESSAGES: Record<string, string> = {
  ERR_ABORTED: "You cancelled the request.",
  ERR_TIMEOUT: "The platform didn't respond in time. Try again.",
  ERR_SIGNATURE: "The response failed signature verification and was rejected.",
  ERR_NOT_EMBEDDED:
    "This app must run inside a Metanet iframe (open it from metanet.page).",
  ERR_NO_BROADCAST_KEY:
    "No broadcast key yet — connect first, or use { broadcast: false }.",
  ERR_BROADCAST_FAILED: "The broadcast API rejected the transaction.",
  ERR_UNSUPPORTED_TOKEN: "That token/ledger isn't supported.",
  ERR_MULTIPLE_RECIPIENTS: "ICP and KDA payments allow exactly one recipient.",
  ERR_TX_NOT_FOUND: "No transaction found for that id.",
  ERR_NO_DATA: "The scan closed with no result.",
  ERR_NOT_SUPPORTED: "This capability isn't supported by the current platform.",
  ERR_ORIGIN: "A response came from a disallowed origin and was rejected.",
  ERR_VALIDATION: "The request parameters failed validation.",
  ERR_DISCONNECTED: "The connection was torn down.",
  ERR_UNKNOWN: "Something went wrong.",
  user_denied: "You declined the request.",
  app_proof_requires_v1:
    "App proofs require a V1 identity. This user is V0 — trust the signed canonicalId instead.",
  invalid_salt: "The salt is invalid (must match /^[A-Za-z0-9._-]{1,64}$/).",
  connection_failed: "The connection attempt failed.",
};

/** Localize an error code (the pattern a real app follows with its own `t`). */
export function t(code: string): string {
  return CODE_MESSAGES[code] ?? code;
}

/**
 * Normalize any caught value into an `ActionResult`.
 *
 * Usage in a panel:
 *   try { const r = await ninja.pay.bsv(...); return okResult('Paid', r); }
 *   catch (e) { return toActionResult(e); }
 */
export function toActionResult(err: unknown): ActionResult {
  if (isNinjaError(err)) {
    const ne = err as NinjaError;
    // ERR_ABORTED is the canonical user-cancel code. ERR_REJECTED is the legacy
    // user-cancel code the create-post overlay historically emitted; both mean
    // "the user backed out" and must render quietly, never as an error.
    if (ne.code === "ERR_ABORTED" || ne.code === "ERR_REJECTED")
      return { kind: "aborted" };
    return {
      kind: "error",
      code: ne.code,
      message: t(ne.code),
      ...(ne.hint ? { hint: ne.hint } : {}),
    };
  }
  // A non-NinjaError is unexpected; still show something useful.
  return {
    kind: "error",
    code: "ERR_UNKNOWN",
    message: err instanceof Error ? err.message : String(err),
  };
}

/** Build a success result. */
export function okResult(message: string, data?: unknown): ActionResult {
  return { kind: "ok", message, data };
}
