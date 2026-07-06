/**
 * App.tsx — entry point for a Metanet social-network app built on shuriken-sdk.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This scaffold shows how to build an app on the Metanet social network
 * (metanet.page) using the official SDK, `shuriken-sdk` (`npm i shuriken-sdk`).
 *
 *   - <SDKProvider> (contexts/SDKProvider.tsx) owns ONE shuriken-sdk client and
 *     publishes it, the normalized identity, and connection status via useSDK().
 *   - Route "#/"        → HomeView (this file — build your app here).
 *   - Route "#/sdkdemo" → Demo.tsx — the FLAGSHIP showcase exercising every SDK
 *     capability for both V0 and V1 identities. Keep it as your live reference.
 *
 * In any child component:
 *
 *   import { useSDK } from './contexts/SDKProvider';
 *   const { ninja, me, status } = useSDK();
 *   // ninja: the shuriken-sdk client (ninja.pay.bsv, ninja.feed.createPost, …)
 *   // me:    version-discriminated identity (anchor on me.canonicalId)
 *   // status:'connecting'|'connected'|'anonymous'|'error'
 *
 * The package's embedded llms.txt + AGENTS.md are the authoritative API reference.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Rocket,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import DemoPage from "./Demo";
import { SDKProvider, useSDK } from "./contexts/SDKProvider";

// ── Simple hash-based router (works inside the sandboxed iframe, no server routing) ──
function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

// ── Home — build your app here ────────────────────────────────────────────────
function HomeView() {
  const { status, me, ninja } = useSDK();

  const label =
    status === "connected"
      ? "Connected"
      : status === "anonymous"
        ? "Anonymous"
        : status === "connecting"
          ? "Connecting…"
          : status === "error"
            ? "Error"
            : "Idle";
  const variant: "default" | "secondary" | "outline" =
    status === "connected"
      ? "default"
      : status === "anonymous"
        ? "outline"
        : "secondary";

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/40 bg-background/80 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl ring-1 ring-primary/20">
            🥷
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              Metanet app · shuriken-sdk
            </h1>
            <p className="text-sm text-muted-foreground">
              Build on the Metanet social network (metanet.page)
            </p>
          </div>
          <Badge variant={variant}>
            {status === "connected" && <CheckCircle className="mr-1 h-3 w-3" />}
            {status === "anonymous" && <UserX className="mr-1 h-3 w-3" />}
            {status === "connecting" && (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            )}
            {label}
          </Badge>
        </div>
      </header>

      <main className="space-y-6 py-8">
        <Card className="border-l-4 border-l-primary border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Scaffold ready</CardTitle>
            <CardDescription>
              A shuriken-sdk client is connected. Build your app in this file;
              use{" "}
              <code className="rounded bg-muted px-1 text-xs">useSDK()</code>{" "}
              for identity, payments, feed, proofs, streams, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === "connected" && me && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">canonicalId: </span>
                <code className="break-all text-xs">{me.canonicalId}</code>
                <span className="ml-2 text-muted-foreground">
                  (identity version {me.version})
                </span>
              </div>
            )}
            {status === "anonymous" && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
                Anonymous — sign in on metanet.page to unlock identity-gated
                features.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Flagship SDK showcase</CardTitle>
                <CardDescription>
                  Every shuriken-sdk capability, live, for V0 and V1 identities.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                window.location.hash = "#/sdkdemo";
              }}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" /> Open the showcase
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                ninja?.openLink("https://www.metanet.page/developers")
              }
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" /> Developer docs
            </Button>
          </CardContent>
        </Card>

        {/*
         * ── YOUR APP GOES HERE ────────────────────────────────────────────
         * Replace/extend below. Use useSDK() for identity + platform commands.
         * ─────────────────────────────────────────────────────────────────
         */}
      </main>
    </div>
  );
}

// ── Root — SDKProvider + hash router ──────────────────────────────────────────
export default function App() {
  const route = useHashRoute();
  const isDemo = route === "#/sdkdemo";
  return (
    <SDKProvider>
      {/* Mandatory Metanet layout container — keep this wrapper. */}
      <div className="mx-auto max-w-[1000px] px-[10px]">
        {isDemo ? <DemoPage /> : <HomeView />}
      </div>
    </SDKProvider>
  );
}
