/**
 * primitives.tsx — small presentational helpers shared by every demo panel.
 *
 * These are pure UI (no SDK logic). They keep each capability panel focused on the
 * shuriken-sdk call it teaches, not on layout boilerplate.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/ninjaError";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** A titled panel wrapping one SDK capability, with an optional numbered step badge. */
export function Panel({
  step,
  title,
  subtitle,
  children,
  right,
}: {
  step?: number | string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {step !== undefined && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                {step}
              </span>
            )}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {right}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Inline monospace code snippet. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  );
}

/** A block of copy-pasteable source, showing the EXACT SDK call a panel makes. */
export function Snippet({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

/** Render an ActionResult (ok / error-with-code / aborted) uniformly. */
export function ResultView({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.kind === "aborted") {
    return (
      <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Request cancelled (<Code>ERR_ABORTED</Code>) — treated as a silent
        no-op.
      </div>
    );
  }
  if (result.kind === "error") {
    return (
      <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="font-mono text-[10px]">
            {result.code}
          </Badge>
          <span className="text-destructive">{result.message}</span>
        </div>
        {result.hint && (
          <div className="text-xs text-muted-foreground">{result.hint}</div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-success">
        <span className="font-medium">{result.message}</span>
      </div>
      {result.data !== undefined && (
        <pre className="overflow-x-auto rounded bg-background/60 p-2 text-xs">
          <code className="font-mono">{safeJson(result.data)}</code>
        </pre>
      )}
    </div>
  );
}

/** A labelled key/value row for identity fields. */
export function Field({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "break-all text-sm",
          mono && "font-mono text-xs",
          value == null && "text-muted-foreground italic",
        )}
      >
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

/** JSON.stringify that survives BigInt (ICP amounts) and cyclic-free objects. */
export function safeJson(v: unknown): string {
  try {
    return JSON.stringify(
      v,
      (_k, val) => (typeof val === "bigint" ? val.toString() : val),
      2,
    );
  } catch {
    return String(v);
  }
}

/** Mask a secret (e.g. genericUseSeed) so its presence is shown without leaking it. */
export function mask(hex: string | undefined | null): string {
  if (!hex) return "—";
  if (hex.length <= 10) return "••••";
  return `${hex.slice(0, 6)}…${hex.slice(-4)} (${hex.length} chars)`;
}
