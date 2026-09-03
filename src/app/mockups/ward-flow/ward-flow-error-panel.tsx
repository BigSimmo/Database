"use client";

import { useEffect, useRef } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { cn, primaryControl } from "@/components/ui-primitives";

/**
 * THE RECOVERY PANEL EVERY WARD FLOW `error.tsx` RENDERS, WRITTEN ONCE.
 *
 * ⚠️ **WHY THIS IS NOT `@/components/route-error-boundary`.** The repository has a shared boundary
 * panel and twenty `error.tsx` files delegate to it, so importing it here was the obvious move and
 * it is the wrong one: `tests/ward-flow-seam.test.ts` holds Ward Flow's outward dependencies at a
 * ceiling of SEVEN approved shared modules, with a canary asserting that list is exactly seven
 * long. That ceiling is the bill for ever extracting this prototype from its host, and its own
 * header says an eighth entry is a decision to be argued rather than a number to be re-baselined.
 * Buying a boundary with a permanent widening of the extraction seam is not a trade this task gets
 * to make on its own, so the panel is duplicated here instead — deliberately, and at the cost of
 * two copies of the same markup drifting apart. `@/components/ui-primitives` IS on the approved
 * list, so the buttons still come from the repository's own controls.
 *
 * ⚠️ **IT MUST NOT SWALLOW THE ERROR.** A boundary that renders "something went wrong" and logs
 * nothing turns a loud failure into a silent one, which is worse than the blanked page it replaces
 * — and it looks like a fix. Three things therefore always happen: the error object goes to
 * `console.error` (so the stack is in the browser console in every environment), the message is
 * rendered on screen, and the stack is put behind a disclosure in development.
 *
 * ⚠️ **SHOWING `error.message` IS SAFE HERE AND WOULD NOT BE EVERYWHERE.** Every patient, bed,
 * referral and instant this prototype holds is invented, so a guard that interpolates part of the
 * failing record into its message cannot leak anything real. `src/proxy.ts` also blocks every
 * `/mockups/**` path in production. Do not copy this decision onto a route serving real data.
 *
 * ⚠️ **"TRY AGAIN" IS HONEST BUT LIMITED, AND THE COPY SAYS SO.** `retry()` re-renders this
 * segment; it does not re-create `WardFlowProvider`, which lives in the layout ABOVE every boundary
 * here and therefore survives. So a guard that throws deterministically on the current world will
 * throw again immediately. That is why "Reload page" is offered beside it: reloading re-seeds the
 * whole prototype, which is the only control on this panel that can actually change the outcome.
 */
export function WardFlowErrorPanel({
  error,
  retry,
  title,
  description,
  logLabel,
  testId,
}: {
  /** The error thrown below this boundary, forwarded by Next. */
  error: Error & { digest?: string };
  /**
   * Next 16's `retry` — NOT the older `reset`. Same reading as
   * `src/app/caring-contacts/error.tsx`: `retry()` re-fetches and re-renders, `reset()` only clears
   * the error state, and a button reading "Try again" should do the former.
   */
  retry: () => void;
  title: string;
  description: string;
  /** Prefix on the console line, so a reader can tell which boundary caught it. */
  logLabel: string;
  testId: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The whole error object, not `error.message`: the console entry is where the stack is
    // reachable in production as well as development.
    console.error(logLabel, error);
    headingRef.current?.focus({ preventScroll: true });
  }, [error, logLabel]);

  // Evaluated at build time by the bundler, so the stack disclosure is not shipped to a production
  // client at all. These routes 404 in production regardless; this is belt and braces.
  const showStack = process.env.NODE_ENV !== "production";

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[color:var(--surface-lux)] px-4 py-8 font-sans text-[color:var(--text)]"
      data-testid={testId}
    >
      <p
        className="w-full max-w-2xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-center text-xs text-[color:var(--text-muted)]"
        data-testid="ward-flow-error-synthetic-notice"
      >
        This is a synthetic prototype. Nothing behind this message is a real patient, bed or service, and nothing was
        changed by the failure.
      </p>

      <div className="w-full max-w-2xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 text-center shadow-[var(--shadow-elevated)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger)]">
          <TriangleAlert aria-hidden="true" className="h-6 w-6" />
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-lg font-semibold tracking-tight text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          {title}
        </h1>

        <p role="alert" className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">
          {description}
        </p>

        {/* The message itself, never a stand-in for it. A boundary that hides what threw is the
            defect this file exists to remove. */}
        <pre
          className="mt-4 overflow-x-auto rounded-lg bg-[color:var(--surface-subtle)] p-3 text-left font-mono text-xs whitespace-pre-wrap text-[color:var(--text)]"
          data-testid="ward-flow-error-message"
        >
          {error.message || "The error carried no message."}
        </pre>

        {error.digest && (
          <p className="mt-2 font-mono text-xs text-[color:var(--text-muted)]" data-testid="ward-flow-error-digest">
            Digest: {error.digest}
          </p>
        )}

        {showStack && error.stack && (
          <details className="mt-3 text-left" data-testid="ward-flow-error-stack">
            <summary className="cursor-pointer text-xs text-[color:var(--text-muted)]">
              Stack trace (development only)
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[color:var(--surface-subtle)] p-3 font-mono text-xs whitespace-pre-wrap text-[color:var(--text-muted)]">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className={cn(primaryControl, "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium")}
            data-testid="ward-flow-error-retry"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            data-testid="ward-flow-error-reload"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
