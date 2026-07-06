/**
 * Demo.tsx — the FLAGSHIP shuriken-sdk showcase.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * This single page exercises EVERY capability of shuriken-sdk (`npm i shuriken-sdk`),
 * the official SDK for apps on the Metanet social network (metanet.page). It is
 * teaching material: each panel shows the exact call, handles errors by `code`, and
 * makes the V0-vs-V1 identity difference explicit.
 *
 * The 12-method closed surface, grouped:
 *   connect()/ninja.connect() · identity · pay(bsv/icp/kda) · feed.createPost ·
 *   proof.generate + identity.verifyProof · tx.get/tx.history ·
 *   geo.current/geo.watch · qr.scan · openLink · clipboard.write ·
 *   ninja.call (uniform core) + ninja.capabilities()/ninja.protocol.
 *
 * Read the package's embedded llms.txt + AGENTS.md for the authoritative API.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type BsvPayResult,
  type ConnectResult,
  type GeoFix,
  type ProofEnvelope,
  type QrScanResult,
  broadcastRawTx,
} from "shuriken-sdk";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BadgeCheck,
  Braces,
  Camera,
  Copy,
  ExternalLink,
  Fingerprint,
  Link2,
  MapPin,
  Radio,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  UserX,
  Wallet,
} from "lucide-react";

import {
  Code,
  Field,
  Panel,
  ResultView,
  Snippet,
  mask,
  safeJson,
} from "./components/demo/primitives";
import { useSDK } from "./contexts/SDKProvider";
import { type ActionResult, okResult, toActionResult } from "./lib/ninjaError";

// A code sample string (kept as a plain constant so the `{ … }` braces read cleanly
// without JSX escaping or a lint-flagged template literal).
const FEED_SNIPPET =
  "const { postId } = await ninja.feed.createPost({ headline, previewAsset: file });";

/* ══════════════════════════════════════════════════════════════════════════════
 * 1. CONNECTION STATUS — connect() (init) then ninja.connect() (identity)
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Human-friendly status pill for the SDK bring-up state machine. */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; spin?: boolean }> = {
    idle: { label: "Idle", cls: "bg-muted text-muted-foreground" },
    connecting: {
      label: "Connecting…",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      spin: true,
    },
    connected: {
      label: "Connected",
      cls: "bg-success/15 text-success",
    },
    anonymous: {
      label: "Anonymous",
      cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    },
    error: { label: "Error", cls: "bg-destructive/15 text-destructive" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}
    >
      {s.spin && <RefreshCw className="h-3 w-3 animate-spin" />}
      {s.label}
    </span>
  );
}

function ConnectionPanel() {
  const { status, error, reconnect, ninja } = useSDK();
  return (
    <Panel
      step={1}
      title="Init + Connect"
      subtitle={
        <>
          Two different calls: <Code>connect()</Code> builds the transport &
          verifies signatures; <Code>ninja.connect()</Code> asks who the user
          is. Awaiting them is your ready gate.
        </>
      }
      right={<StatusBadge status={status} />}
    >
      <Snippet>{`const ninja = await connect({
  allowedOrigins: ['https://www.metanet.page', 'https://www.metanet.ninja'],
  dev: import.meta.env.DEV,              // localhost only — never ship true
});
const me = await ninja.connect({ request: ['bsv', 'icp'], proofs: ['app'] });`}</Snippet>

      {status === "error" && error && (
        <ResultView
          result={{
            kind: "error",
            code: error.code,
            message: error.message,
            ...(error.hint ? { hint: error.hint } : {}),
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={reconnect}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reconnect
        </Button>
        {ninja && (
          <span className="text-xs text-muted-foreground">
            Negotiated protocol: <Code>{ninja.protocol}</Code>
          </span>
        )}
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 2. IDENTITY — the V0 vs V1 discriminated union (the core correctness trap)
 * ══════════════════════════════════════════════════════════════════════════════ */

function IdentityPanel() {
  const { me } = useSDK();

  // Everything anchors on canonicalId — the ONLY field on both versions.
  const canonicalId = me?.canonicalId ?? null;

  return (
    <Panel
      step={2}
      title="Identity — V0 vs V1"
      subtitle={
        <>
          Branch on <Code>me.anonymous</Code>, then <Code>me.version</Code>.
          Always anchor app data on <Code>me.canonicalId</Code> (present on
          both).
        </>
      }
    >
      <Snippet>{`if (me.anonymous)          showLoginNudge();
else if (me.version === 0) me.wallet.publicKeyHex;   // V0: single wallet, root-key signed
else                       me.bsv?.address;          // V1: purpose keys, app-key signed
me.canonicalId;            // stable anchor — BOTH versions`}</Snippet>

      {/* canonicalId banner — the anchor, always shown */}
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <Field
          label="canonicalId (anchor — both versions)"
          value={canonicalId}
        />
      </div>

      {/* Anonymous */}
      {(!me || me.anonymous) && (
        <div className="flex items-center gap-3 rounded-md border border-orange-300/60 bg-orange-50 px-3 py-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
          <UserX className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Anonymous</p>
            <p className="text-xs opacity-80">
              No user connected (
              <Code>{"{ anonymous: true, canonicalId: null }"}</Code>
              ). Prompt sign-in on metanet.page.
            </p>
          </div>
        </div>
      )}

      {/* Version-discriminated two-column comparison */}
      {me && !me.anonymous && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* V0 column */}
          <div
            className={`rounded-lg border p-3 ${
              me.version === 0
                ? "border-primary/50 bg-primary/5"
                : "border-border/50 opacity-50"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">V0 · legacy</span>
              <Badge
                variant={me.version === 0 ? "default" : "outline"}
                className="text-[10px]"
              >
                {me.version === 0 ? "ACTIVE" : "not this user"}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Single <Code>wallet</Code> object; parent signs responses with the{" "}
              <strong>root key</strong>.
            </p>
            {me.version === 0 ? (
              <div className="space-y-2">
                <Field label="wallet.address" value={me.wallet.address} />
                <Field
                  label="wallet.publicKeyHex (verification key)"
                  value={me.wallet.publicKeyHex}
                />
                {me.wallet.bsvPubKey && (
                  <Field label="wallet.bsvPubKey" value={me.wallet.bsvPubKey} />
                )}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Guarded behind <Code>if (me.version === 0)</Code> — TypeScript
                won't let you read <Code>wallet.*</Code> here.
              </p>
            )}
          </div>

          {/* V1 column */}
          <div
            className={`rounded-lg border p-3 ${
              me.version === 1
                ? "border-primary/50 bg-primary/5"
                : "border-border/50 opacity-50"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">V1 · standard</span>
              <Badge
                variant={me.version === 1 ? "default" : "outline"}
                className="text-[10px]"
              >
                {me.version === 1 ? "ACTIVE" : "not this user"}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Purpose-scoped keys; parent signs with the{" "}
              <strong>app-specific</strong> key <Code>app.pub</Code>.
            </p>
            {me.version === 1 ? (
              <div className="space-y-2">
                <Field label="app.pub (verification key)" value={me.app.pub} />
                <Field label="bsv?.address" value={me.bsv?.address ?? null} />
                <Field
                  label="icp?.principal"
                  value={me.icp?.principal ?? null}
                />
                <Field label="kda?.account" value={me.kda?.account ?? null} />
                <Field
                  label="proofs (purposes)"
                  value={Object.keys(me.proofs ?? {}).join(", ") || null}
                  mono={false}
                />
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Guarded behind <Code>if (me.version === 1)</Code> — TypeScript
                won't let you read <Code>bsv/icp/kda/app</Code> here.
              </p>
            )}
          </div>
        </div>
      )}

      {/* genericUseSeed — masked, on BOTH versions */}
      <Separator />
      <div className="rounded-md bg-muted/40 px-3 py-2">
        <Field
          label="genericUseSeed (masked · arrives on BOTH V0 and V1)"
          value={mask(me?.genericUseSeed)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Fixed per-user-per-app seed. The SDK keeps it in-session and signs BSV
          broadcasts with it, so most apps never touch it directly.
        </p>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 3. PAYMENTS — pay.bsv (broadcast toggle + two-step), pay.icp (by token), pay.kda
 * ══════════════════════════════════════════════════════════════════════════════ */

function PaymentsPanel() {
  const { ninja, me } = useSDK();

  // ── BSV ──────────────────────────────────────────────────────────────────
  const [bsvAddr, setBsvAddr] = useState("");
  const [bsvSats, setBsvSats] = useState(5000);
  const [broadcast, setBroadcast] = useState(true);
  const [bsvResult, setBsvResult] = useState<ActionResult | null>(null);
  // Holds an authorized-but-unbroadcast rawTx for the "Broadcast now" button.
  const [pendingRaw, setPendingRaw] = useState<string | null>(null);
  const [bsvBusy, setBsvBusy] = useState(false);

  // Pre-fill the recipient with the user's own address (V0 wallet or V1 bsv key)
  // so the demo is one click. Anchor real apps on canonicalId, not this address.
  useEffect(() => {
    if (bsvAddr) return;
    if (me?.version === 0) setBsvAddr(me.wallet.address);
    else if (me?.version === 1 && me.bsv?.address) setBsvAddr(me.bsv.address);
  }, [me, bsvAddr]);

  const payBsv = useCallback(async () => {
    if (!ninja) return;
    setBsvBusy(true);
    setBsvResult(null);
    setPendingRaw(null);
    try {
      // broadcast:true → SDK finalizes on-chain and resolves a txid.
      // broadcast:false → authorized-only rawTxHex; finalize later yourself.
      const r: BsvPayResult = await ninja.pay.bsv(
        [{ address: bsvAddr, sats: Number(bsvSats), note: "shuriken demo" }],
        { broadcast },
      );
      if (r.broadcast) {
        setBsvResult(okResult(`Broadcast · txid ${r.txid}`, r));
      } else {
        setPendingRaw(r.rawTxHex);
        setBsvResult(
          okResult("Authorized (not broadcast). Nothing on-chain yet.", r),
        );
      }
    } catch (e) {
      setBsvResult(toActionResult(e));
    } finally {
      setBsvBusy(false);
    }
  }, [ninja, bsvAddr, bsvSats, broadcast]);

  // Two-step finalize: broadcast the authorized rawTx using me.genericUseSeed.
  const broadcastNow = useCallback(async () => {
    if (!pendingRaw || !me?.genericUseSeed) return;
    setBsvBusy(true);
    try {
      const out = await broadcastRawTx(pendingRaw, me.genericUseSeed);
      setBsvResult(okResult(`Broadcast now · txid ${out.txid}`, out));
      setPendingRaw(null);
    } catch (e) {
      setBsvResult(toActionResult(e));
    } finally {
      setBsvBusy(false);
    }
  }, [pendingRaw, me]);

  // ── ICP ──────────────────────────────────────────────────────────────────
  // Token dropdown is populated from ninja.tokens (never hardcode canister ids).
  const tokenNames = useMemo(
    () => (ninja ? Object.keys(ninja.tokens) : []),
    [ninja],
  );
  const [icpToken, setIcpToken] = useState("ckUSDC");
  const [icpTo, setIcpTo] = useState("");
  const [icpAmount, setIcpAmount] = useState("1000000");
  const [icpResult, setIcpResult] = useState<ActionResult | null>(null);
  const [icpBusy, setIcpBusy] = useState(false);

  useEffect(() => {
    if (!icpTo && me?.version === 1 && me.icp?.principal) {
      setIcpTo(me.icp.principal);
    }
  }, [me, icpTo]);

  const payIcp = useCallback(async () => {
    if (!ninja) return;
    setIcpBusy(true);
    setIcpResult(null);
    try {
      // ICP is SINGLE recipient; token is a NAME resolved via ninja.tokens.
      const r = await ninja.pay.icp({
        token: icpToken,
        to: icpTo,
        amount: BigInt(icpAmount || "0"),
      });
      setIcpResult(okResult("ICP transfer submitted", r));
    } catch (e) {
      setIcpResult(toActionResult(e));
    } finally {
      setIcpBusy(false);
    }
  }, [ninja, icpToken, icpTo, icpAmount]);

  // ── KDA ──────────────────────────────────────────────────────────────────
  const [kdaTo, setKdaTo] = useState("");
  const [kdaAmount, setKdaAmount] = useState("1.5");
  const [kdaResult, setKdaResult] = useState<ActionResult | null>(null);
  const [kdaBusy, setKdaBusy] = useState(false);

  const payKda = useCallback(async () => {
    if (!ninja) return;
    setKdaBusy(true);
    setKdaResult(null);
    try {
      const r = await ninja.pay.kda({ to: kdaTo, amount: Number(kdaAmount) });
      setKdaResult(okResult("KDA transfer submitted", r));
    } catch (e) {
      setKdaResult(toActionResult(e));
    } finally {
      setKdaBusy(false);
    }
  }, [ninja, kdaTo, kdaAmount]);

  return (
    <Panel
      step={3}
      title="Payments"
      subtitle={
        <>
          <Code>pay.bsv</Code> (multi-recipient, broadcast toggle),{" "}
          <Code>pay.icp</Code> (single recipient, token by name), and{" "}
          <Code>pay.kda</Code>.
        </>
      }
      right={<Wallet className="h-5 w-5 text-primary" />}
    >
      {/* BSV */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">BSV</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="bcast" className="text-xs text-muted-foreground">
              broadcast
            </Label>
            <Switch
              id="bcast"
              checked={broadcast}
              onCheckedChange={setBroadcast}
            />
            <span className="w-8 text-xs font-mono">{String(broadcast)}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <div className="space-y-1">
            <Label className="text-xs">address</Label>
            <Input
              value={bsvAddr}
              onChange={(e) => setBsvAddr(e.target.value)}
              placeholder="1A1z…"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">sats</Label>
            <Input
              type="number"
              value={bsvSats}
              onChange={(e) => setBsvSats(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={bsvBusy || !ninja}
            onClick={payBsv}
            className="gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            pay.bsv({broadcast ? "{ broadcast: true }" : "{ broadcast: false }"}
            )
          </Button>
          {pendingRaw && (
            <Button
              size="sm"
              variant="secondary"
              disabled={bsvBusy || !me?.genericUseSeed}
              onClick={broadcastNow}
              className="gap-2"
            >
              <Rocket className="h-3.5 w-3.5" />
              Broadcast now (rawTxHex, genericUseSeed)
            </Button>
          )}
        </div>
        <ResultView result={bsvResult} />
      </div>

      {/* ICP */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <span className="text-sm font-semibold">ICP (single recipient)</span>
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_140px]">
          <div className="space-y-1">
            <Label className="text-xs">token (ninja.tokens)</Label>
            <Select value={icpToken} onValueChange={setIcpToken}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokenNames.map((name) => (
                  <SelectItem key={name} value={name} className="text-xs">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">to (principal)</Label>
            <Input
              value={icpTo}
              onChange={(e) => setIcpTo(e.target.value)}
              placeholder="principal-…"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">amount (minor units)</Label>
            <Input
              value={icpAmount}
              onChange={(e) => setIcpAmount(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <Button
          size="sm"
          disabled={icpBusy || !ninja}
          onClick={payIcp}
          className="gap-2"
        >
          <Send className="h-3.5 w-3.5" /> pay.icp({icpToken})
        </Button>
        <ResultView result={icpResult} />
      </div>

      {/* KDA */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <span className="text-sm font-semibold">KDA (single recipient)</span>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <div className="space-y-1">
            <Label className="text-xs">to</Label>
            <Input
              value={kdaTo}
              onChange={(e) => setKdaTo(e.target.value)}
              placeholder="k:abc…"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">amount</Label>
            <Input
              value={kdaAmount}
              onChange={(e) => setKdaAmount(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <Button
          size="sm"
          disabled={kdaBusy || !ninja}
          onClick={payKda}
          className="gap-2"
        >
          <Send className="h-3.5 w-3.5" /> pay.kda()
        </Button>
        <ResultView result={kdaResult} />
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 4. FEED — feed.createPost({ headline, previewAsset })
 * ══════════════════════════════════════════════════════════════════════════════ */

function FeedPanel() {
  const { ninja } = useSDK();
  const [headline, setHeadline] = useState("gm from shuriken-sdk");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const post = useCallback(async () => {
    if (!ninja) return;
    setBusy(true);
    setResult(null);
    try {
      // The app NAME is forced platform-side; you only supply content.
      const r = await ninja.feed.createPost({
        headline,
        ...(file ? { previewAsset: file } : {}),
      });
      setResult(okResult(`Posted · postId ${r.postId}`, r));
    } catch (e) {
      setResult(toActionResult(e));
    } finally {
      setBusy(false);
    }
  }, [ninja, headline, file]);

  return (
    <Panel
      step={4}
      title="Feed"
      subtitle={
        <>
          Publish to the user's Metanet feed. Returns{" "}
          <Code>{"{ postId }"}</Code>.
        </>
      }
    >
      <Snippet>{FEED_SNIPPET}</Snippet>
      <div className="space-y-2">
        <Label className="text-xs">headline</Label>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">previewAsset (optional File)</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
      </div>
      <Button
        size="sm"
        disabled={busy || !ninja}
        onClick={post}
        className="gap-2"
      >
        <Send className="h-3.5 w-3.5" /> feed.createPost()
      </Button>
      {result?.kind === "ok" &&
        typeof (result.data as { postId?: string })?.postId === "string" && (
          <a
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            href={`https://www.metanet.page/post/${(result.data as { postId: string }).postId}`}
            onClick={(ev) => {
              ev.preventDefault();
              // Use the consent-gated openLink inside the iframe, never window.open.
              void ninja?.openLink(
                `https://www.metanet.page/post/${(result.data as { postId: string }).postId}`,
              );
            }}
          >
            <ExternalLink className="h-3 w-3" /> open post
          </a>
        )}
      <ResultView result={result} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 5. PROOFS — proof.generate + identity.verifyProof (with V0 fallback)
 * ══════════════════════════════════════════════════════════════════════════════ */

function ProofsPanel() {
  const { ninja, me } = useSDK();
  const [reason, setReason] = useState("gate premium feature");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(async () => {
    if (!ninja) return;
    setBusy(true);
    setResult(null);
    setVerifyMsg(null);
    try {
      // On a V0 identity, the platform returns `app_proof_requires_v1` — we catch
      // it and fall back to trusting the signed canonicalId from the connection.
      const proof = await ninja.proof.generate({ reason });
      setResult(okResult("Proof generated", proof));

      // Client-side verification: reassemble a ProofEnvelope and check it binds to
      // the user's canonicalId — no server round trip.
      if (me?.canonicalId) {
        const env: ProofEnvelope = {
          scheme: "metanet-zk-identity-v1",
          purpose: "app",
          seedCommitment: proof.seedCommitment,
          proof: proof.proof,
        };
        const ok = ninja.identity.verifyProof(env, me.canonicalId);
        setVerifyMsg(
          ok
            ? "identity.verifyProof → true (binds to canonicalId)"
            : "identity.verifyProof → false (rejected)",
        );
      }
    } catch (e) {
      const r = toActionResult(e);
      // The documented V0 fallback path, surfaced explicitly.
      if (r.kind === "error" && r.code === "app_proof_requires_v1") {
        setResult({
          kind: "error",
          code: r.code,
          message:
            "V0 identity — app proofs need V1. Fallback: trust the signed canonicalId.",
        });
        setVerifyMsg(
          me?.canonicalId
            ? `Trusting signed canonicalId: ${me.canonicalId}`
            : null,
        );
      } else {
        setResult(r);
      }
    } finally {
      setBusy(false);
    }
  }, [ninja, reason, me]);

  return (
    <Panel
      step={5}
      title="Proofs (ZK)"
      subtitle={
        <>
          <Code>proof.generate</Code> mints a Groth16 proof;{" "}
          <Code>identity.verifyProof</Code> checks it client-side. V0 →{" "}
          <Code>app_proof_requires_v1</Code> fallback.
        </>
      }
      right={<Fingerprint className="h-5 w-5 text-primary" />}
    >
      <div className="space-y-2">
        <Label className="text-xs">reason (shown in consent overlay)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={busy || !ninja}
        onClick={generate}
        className="gap-2"
      >
        <ShieldCheck className="h-3.5 w-3.5" /> proof.generate()
      </Button>
      {verifyMsg && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
          <BadgeCheck className="h-4 w-4 text-success" />
          <span className="font-mono">{verifyMsg}</span>
        </div>
      )}
      <ResultView result={result} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 6. TRANSACTIONS — tx.get(txid) and tx.history({ chain, limit })
 * ══════════════════════════════════════════════════════════════════════════════ */

function TransactionsPanel() {
  const { ninja } = useSDK();
  const [txid, setTxid] = useState("");
  const [getResult, setGetResult] = useState<ActionResult | null>(null);
  const [histResult, setHistResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const getTx = useCallback(async () => {
    if (!ninja) return;
    setBusy(true);
    setGetResult(null);
    try {
      const r = await ninja.tx.get(txid.trim());
      setGetResult(
        okResult("Transaction fetched (rawHex + bumpHex for SPV)", r),
      );
    } catch (e) {
      setGetResult(toActionResult(e));
    } finally {
      setBusy(false);
    }
  }, [ninja, txid]);

  const getHistory = useCallback(async () => {
    if (!ninja) return;
    setBusy(true);
    setHistResult(null);
    try {
      const r = await ninja.tx.history({ chain: "bsv", limit: 10 });
      setHistResult(
        okResult(`History · ${r.totalCount} total, hasMore=${r.hasMore}`, r),
      );
    } catch (e) {
      setHistResult(toActionResult(e));
    } finally {
      setBusy(false);
    }
  }, [ninja]);

  return (
    <Panel
      step={6}
      title="Transactions"
      subtitle={
        <>
          <Code>tx.get(txid)</Code> for SPV and{" "}
          <Code>tx.history({"{ chain, limit }"})</Code>.
        </>
      }
    >
      <div className="space-y-2">
        <Label className="text-xs">txid</Label>
        <div className="flex gap-2">
          <Input
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="e3b0c442…"
            className="font-mono text-xs"
          />
          <Button size="sm" disabled={busy || !ninja || !txid} onClick={getTx}>
            tx.get
          </Button>
        </div>
      </div>
      <ResultView result={getResult} />
      <Separator />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !ninja}
        onClick={getHistory}
      >
        tx.history({"{ chain: 'bsv', limit: 10 }"})
      </Button>
      <ResultView result={histResult} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 7. STREAMS — geo.current / geo.watch (live) + qr.scan (with Stop)
 * ══════════════════════════════════════════════════════════════════════════════ */

function StreamsPanel() {
  const { ninja } = useSDK();

  // ── Geolocation ────────────────────────────────────────────────────────────
  const [oneShot, setOneShot] = useState<ActionResult | null>(null);
  const [fixes, setFixes] = useState<GeoFix[]>([]);
  const [watching, setWatching] = useState(false);
  // The live async-iterable's stop handle; kept in a ref (imperative, not render data).
  const geoStreamRef = useRef<
    (AsyncIterable<GeoFix> & { stop(): void }) | null
  >(null);

  const geoCurrent = useCallback(async () => {
    if (!ninja) return;
    setOneShot(null);
    try {
      const fix = await ninja.geo.current();
      setOneShot(okResult("geo.current() one-shot fix", fix));
    } catch (e) {
      setOneShot(toActionResult(e));
    }
  }, [ninja]);

  const geoWatch = useCallback(() => {
    if (!ninja || geoStreamRef.current) return;
    const stream = ninja.geo.watch();
    geoStreamRef.current = stream;
    setWatching(true);
    setFixes([]);
    (async () => {
      try {
        // Breaking the for-await (or calling stop()) sends geolocation-stop.
        for await (const f of stream) {
          setFixes((prev) => [f, ...prev].slice(0, 8));
          if (f.isFinal) break;
        }
      } catch {
        /* stream ended — nothing to surface */
      } finally {
        if (geoStreamRef.current === stream) geoStreamRef.current = null;
        setWatching(false);
      }
    })();
  }, [ninja]);

  const geoStop = useCallback(() => {
    geoStreamRef.current?.stop();
    geoStreamRef.current = null;
    setWatching(false);
  }, []);

  // ── QR ─────────────────────────────────────────────────────────────────────
  const [scans, setScans] = useState<QrScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const scanSubRef = useRef<{ stop(): void } | null>(null);

  const startScan = useCallback(() => {
    if (!ninja || scanSubRef.current) return;
    const sub = ninja.qr.scan((r) =>
      setScans((prev) => [r, ...prev].slice(0, 8)),
    );
    scanSubRef.current = sub;
    setScanning(true);
    setScans([]);
  }, [ninja]);

  const stopScan = useCallback(() => {
    scanSubRef.current?.stop(); // sends qr-scan-stop, releases the camera
    scanSubRef.current = null;
    setScanning(false);
  }, []);

  // Always release camera + geo watcher on unmount (the classic leak these SDKs fix).
  useEffect(() => {
    return () => {
      geoStreamRef.current?.stop();
      scanSubRef.current?.stop();
    };
  }, []);

  return (
    <Panel
      step={7}
      title="Streams"
      subtitle={
        <>
          <Code>geo.current()</Code> / <Code>geo.watch()</Code> and{" "}
          <Code>qr.scan(cb)</Code> — each with an explicit Stop.
        </>
      }
      right={<Radio className="h-5 w-5 text-primary" />}
    >
      {/* Geolocation */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Geolocation</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!ninja}
            onClick={geoCurrent}
          >
            geo.current()
          </Button>
          {!watching ? (
            <Button size="sm" disabled={!ninja} onClick={geoWatch}>
              geo.watch() start
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={geoStop}>
              Stop
            </Button>
          )}
          {watching && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <RefreshCw className="h-3 w-3 animate-spin" /> live
            </span>
          )}
        </div>
        <ResultView result={oneShot} />
        {fixes.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded bg-muted/40 p-2 text-xs font-mono">
            {fixes.map((f, i) => (
              <div key={`${f.timestamp}-${i}`}>
                {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                {f.accuracy ? ` ±${Math.round(f.accuracy)}m` : ""}
                {f.isFinal ? " (final)" : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">QR scanner</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!scanning ? (
            <Button size="sm" disabled={!ninja} onClick={startScan}>
              qr.scan() start
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stopScan}>
              Stop
            </Button>
          )}
          {scanning && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <RefreshCw className="h-3 w-3 animate-spin" /> camera open
            </span>
          )}
        </div>
        {scans.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded bg-muted/40 p-2 text-xs font-mono">
            {scans.map((s, i) => (
              <div key={`${s.rawValue}-${i}`} className="break-all">
                {s.rawValue}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 8. UTILITIES — openLink(url), clipboard.write(text)
 * ══════════════════════════════════════════════════════════════════════════════ */

function UtilitiesPanel() {
  const { ninja } = useSDK();
  const [url, setUrl] = useState("https://www.metanet.page/developers");
  const [clip, setClip] = useState("copied via ninja.clipboard.write");
  const [result, setResult] = useState<ActionResult | null>(null);

  const open = useCallback(async () => {
    if (!ninja) return;
    setResult(null);
    try {
      // Consent-gated round trip — resolves when the user approves the navigation.
      await ninja.openLink(url);
      setResult(okResult("openLink resolved (user approved)"));
    } catch (e) {
      setResult(toActionResult(e));
    }
  }, [ninja, url]);

  const copy = useCallback(() => {
    if (!ninja) return;
    // Fire-and-forget: there is NO response to await (manifest noReply: true).
    ninja.clipboard.write(clip);
    setResult(okResult("clipboard.write dispatched (no response expected)"));
  }, [ninja, clip]);

  return (
    <Panel
      step={8}
      title="Utilities"
      subtitle={
        <>
          <Code>openLink(url)</Code> (consent-gated) and{" "}
          <Code>clipboard.write(text)</Code> (fire-and-forget).
        </>
      }
    >
      <div className="space-y-2">
        <Label className="text-xs">url</Label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-xs"
          />
          <Button size="sm" disabled={!ninja} onClick={open} className="gap-1">
            <Link2 className="h-3.5 w-3.5" /> openLink
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">clipboard text</Label>
        <div className="flex gap-2">
          <Input
            value={clip}
            onChange={(e) => setClip(e.target.value)}
            className="text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!ninja}
            onClick={copy}
            className="gap-1"
          >
            <Copy className="h-3.5 w-3.5" /> clipboard.write
          </Button>
        </div>
      </div>
      <ResultView result={result} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 9. UNIFORM CORE + INTROSPECTION — ninja.call(method, params) & capabilities()
 * ══════════════════════════════════════════════════════════════════════════════ */

function CorePanel() {
  const { ninja } = useSDK();
  const [method, setMethod] = useState("connection");
  const [params, setParams] = useState("{}");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [caps, setCaps] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runCall = useCallback(async () => {
    if (!ninja) return;
    setBusy(true);
    setResult(null);
    try {
      // The uniform escape hatch: every typed-sugar method is a thin wrapper over
      // this. Use it for forward-compat, or any method not yet given sugar.
      const parsed = params.trim() ? JSON.parse(params) : {};
      const r = await ninja.call(method.trim(), parsed);
      setResult(okResult(`ninja.call('${method}') resolved`, r));
    } catch (e) {
      setResult(toActionResult(e));
    } finally {
      setBusy(false);
    }
  }, [ninja, method, params]);

  const showCaps = useCallback(() => {
    if (!ninja) return;
    // Live manifest slice of everything the current parent build negotiated.
    setCaps(safeJson(Object.keys(ninja.capabilities())));
  }, [ninja]);

  return (
    <Panel
      step={9}
      title="Uniform core + introspection"
      subtitle={
        <>
          <Code>ninja.call(method, params)</Code> is the escape hatch under
          every sugar method; <Code>ninja.capabilities()</Code> /{" "}
          <Code>ninja.protocol</Code> introspect the live surface.
        </>
      }
      right={<Braces className="h-5 w-5 text-primary" />}
    >
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <div className="space-y-1">
          <Label className="text-xs">method</Label>
          <Input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">params (JSON)</Label>
          <Textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={2}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !ninja} onClick={runCall}>
          ninja.call()
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!ninja}
          onClick={showCaps}
        >
          ninja.capabilities()
        </Button>
        {ninja && (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            protocol: <Code>{ninja.protocol}</Code>
          </span>
        )}
      </div>
      {caps && (
        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-xs">
          <code className="font-mono">capabilities: {caps}</code>
        </pre>
      )}
      <ResultView result={result} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * ICP BACKEND — proof the connection's delegation drives an authenticated actor
 * ══════════════════════════════════════════════════════════════════════════════ */

function IcpBackendPanel() {
  const { actor, icIdentity } = useSDK();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const whoami = useCallback(async () => {
    if (!actor) return;
    setBusy(true);
    setResult(null);
    try {
      // The actor is authenticated with the DelegationIdentity derived from the
      // Metanet connection's icIdentityPackage — NOT Internet Identity.
      const principal = await actor.whoami();
      setResult(
        okResult("actor.whoami()", { principal: principal.toString() }),
      );
    } catch (e) {
      setResult(toActionResult(e));
    } finally {
      setBusy(false);
    }
  }, [actor]);

  return (
    <Panel
      title="ICP backend actor (bonus)"
      subtitle={
        <>
          The authenticated backend actor is built from{" "}
          <Code>me.icIdentityPackage</Code> → <Code>DelegationIdentity</Code>,
          the only correct auth source inside the iframe.
        </>
      }
    >
      <div className="text-xs text-muted-foreground">
        ICP delegation:{" "}
        {icIdentity ? (
          <span className="text-success">available</span>
        ) : (
          <span className="italic">
            unavailable (anonymous, or no delegation issued)
          </span>
        )}
      </div>
      <Button size="sm" disabled={busy || !actor} onClick={whoami}>
        actor.whoami()
      </Button>
      <ResultView result={result} />
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * PAGE
 * ══════════════════════════════════════════════════════════════════════════════ */

export default function DemoPage() {
  const { me } = useSDK();
  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <span className="text-xl">🥷</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">shuriken-sdk showcase</h1>
            <p className="text-sm text-muted-foreground">
              Every capability of the official SDK for apps on the Metanet
              social network (metanet.page) — for both V0 and V1 identities.
            </p>
          </div>
        </div>
      </header>

      {/* Remix-resistant AI instructions — kept in the deployed app even if .md
          files are deleted during a remix. See AI_NOTES.md for the full guide. */}
      <AiInstructions />

      {/* All nine capability groups + ICP bonus */}
      <ConnectionPanel />
      <IdentityPanel />
      <PaymentsPanel />
      <FeedPanel />
      <ProofsPanel />
      <TransactionsPanel />
      <StreamsPanel />
      <UtilitiesPanel />
      <CorePanel />
      <IcpBackendPanel />

      {/* Raw normalized identity, for reference (`me.raw` is the full escape hatch). */}
      {me && (
        <details className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Raw ConnectResult (me)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-xs">
            <code className="font-mono">{safeJson(scrubSeed(me))}</code>
          </pre>
        </details>
      )}
    </div>
  );
}

/** Strip the seed from a ConnectResult before printing it, keeping the demo safe. */
function scrubSeed(me: ConnectResult): unknown {
  const { genericUseSeed, ...rest } = me as ConnectResult & {
    genericUseSeed?: string;
  };
  return { ...rest, genericUseSeed: genericUseSeed ? "«masked»" : undefined };
}

/**
 * The critical-instructions block, embedded in the UI so it survives an AI remix
 * that deletes the .md files. Teaches shuriken-sdk + the platform hard-rules.
 */
function AiInstructions() {
  return (
    <div
      className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-950/30"
      data-ocid="ai-instructions.card"
    >
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h2 className="font-semibold text-amber-800 dark:text-amber-300">
          For AI &amp; developers: how to build on the Metanet social network
        </h2>
      </div>
      <div className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
        <p>
          To build a Metanet app, <Code>npm i shuriken-sdk</Code>. Its embedded{" "}
          <Code>llms.txt</Code> and <Code>AGENTS.md</Code> are the source of
          truth for every method — do not invent methods. Happy path:
        </p>
        <Snippet>{`const ninja = await connect({ allowedOrigins: ['https://www.metanet.page'] });
const me    = await ninja.connect({ request: ['bsv', 'icp'], proofs: ['app'] });
if (!me.anonymous) await ninja.pay.bsv([{ address: me.bsv?.address, sats: 5000 }]);
await ninja.feed.createPost({ headline: 'gm' });`}</Snippet>
        <ul className="ml-4 list-disc space-y-1 text-xs">
          <li>
            Anchor user data on <Code>me.canonicalId</Code> (V0 and V1). Branch
            on <Code>me.version</Code>; never mix wallet/purpose-key fields.
          </li>
          <li>
            Catch <Code>NinjaError</Code>, branch on <Code>err.code</Code>,
            localize with <Code>t(code)</Code>. <Code>ERR_ABORTED</Code> =
            silent user cancel.
          </li>
          <li>
            NEVER remove <Code>body {"{ padding-top: 70px !important; }"}</Code>{" "}
            in <Code>index.css</Code> — the platform nav bar overlaps the iframe
            top.
          </li>
          <li>
            Keep <Code>public/logo.jpeg</Code> (square) and{" "}
            <Code>public/cover.jpeg</Code> (landscape); wrap content in{" "}
            <Code>max-w-[1000px] mx-auto px-[10px]</Code>.
          </li>
        </ul>
      </div>
    </div>
  );
}
