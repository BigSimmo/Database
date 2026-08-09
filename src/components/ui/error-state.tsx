"use client";

import { CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AsyncButton, cn, floatingControl } from "@/components/ui-primitives";
import { createBoundedDiagnosticRecorder } from "@/components/ui/design-system-diagnostics";

/**
 * COMPONENTS §0.3 and SPEC §10, "Search failed → `ErrorState`", with the copy
 * rule stated as a prohibition: **never "0 matches" after a failed request**.
 *
 * The distinction this component exists to hold is not cosmetic. A search that
 * failed has no count to report, so reporting zero is a false statement about
 * the corpus rather than a tidy fallback — on the services page "0 matches"
 * asserts there are no crisis services when the search never ran, and on
 * favourites it reads as "you have saved nothing" rather than "we could not
 * load them". `MissingValue` draws the same line from the other side: "no
 * result count is available" is not a missing value.
 *
 * So the component takes **no count and no children**. There is no prop through
 * which a number can arrive, which is the only version of this rule that
 * survives a hurried call site. The one remaining route — a caller writing the
 * count into `title` or `body` themselves — is covered by a development-time
 * tripwire below rather than by trust.
 *
 * Six surfaces hand-roll this guard today, several with comments explaining the
 * rule (`search-results-header-band.tsx`, `services-navigator-page.tsx`,
 * `favourites-command-library-page.tsx`, `document-search-results.tsx`, and the
 * differentials pages). They are correct; they are simply not shared. Adopting
 * them is a live-look change and deliberately not part of landing this.
 */

export type ErrorStateReason = "request_failed" | "unauthorized" | "timeout" | "unknown";

export type ErrorStateProps = {
  reason: ErrorStateReason;
  /**
   * What could not be loaded — "Services", "Favourites", "DSM diagnoses". Names
   * the subject of the failed request, never its size. Omitted, the copy falls
   * back to a subject-less phrasing rather than inventing one.
   */
  subject?: string;
  /** Overrides the derived heading. Still may not carry a result count. */
  title?: string;
  /** Overrides the derived supporting line. Still may not carry a result count. */
  body?: string;
  /**
   * Recovery. Async so a call site can await its refetch and get the busy state
   * for free; a rejected retry leaves this state on screen rather than escaping
   * as an unhandled rejection, because the failure surface is already correct.
   */
  onRetry?: () => void | Promise<void>;
  /** Additional recovery affordances — a sign-in link, "Browse library". */
  actions?: ReactNode;
  /**
   * `inline` drops the panel chrome for use inside a surface that already owns
   * a border, exactly as the search band's fault panel sits inside the ribbon.
   */
  density?: "panel" | "inline";
  /**
   * Announcement. A failure introduced dynamically is worth interrupting for,
   * so this defaults to `assertive`; pass `off` where the state is present on
   * first paint and the surrounding region already names it.
   */
  live?: "off" | "polite" | "assertive";
  testId?: string;
  className?: string;
};

const TITLES: Record<ErrorStateReason, (subject: string | undefined) => string> = {
  request_failed: (subject) => (subject ? `${subject} could not be loaded` : "That could not be loaded"),
  unauthorized: () => "Sign in to continue",
  timeout: (subject) => (subject ? `${subject} took too long to load` : "That took too long to load"),
  unknown: (subject) => (subject ? `${subject} could not be loaded` : "That could not be loaded"),
};

const BODIES: Record<ErrorStateReason, string> = {
  request_failed: "The request could not be completed. Try again shortly.",
  unauthorized: "Your session has expired. Sign in again to run this search.",
  timeout: "The request did not finish in time. Try again shortly.",
  unknown: "The request could not be completed. Try again shortly.",
};

/**
 * A result count written into caller copy — "0 matches", "no results found",
 * "2 documents". The number is matched against the counted noun rather than on
 * its own, so an error code ("Error 503") or a duration ("retry in 30 seconds")
 * does not trip it. Warn-only and development-only: a noisy false positive on a
 * clinical surface is worse than the miss, and a thrown error here would turn a
 * copy defect into a blank page on the one screen already reporting a failure.
 */
const RESULT_COUNT_IN_COPY = /\b(?:\d[\d,.]*|no|zero)\s+(?:match|result|document|source|item|record)s?\b/i;

const recordDiagnostic = createBoundedDiagnosticRecorder({
  emit: (message) => {
    if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") console.warn(message);
  },
});

/** Enum resilience per SPEC §7: an unrecognised reason degrades and never throws. */
export function errorStateCopy(
  reason: ErrorStateReason,
  subject?: string,
): { title: string; body: string; reason: ErrorStateReason } {
  const known = Object.hasOwn(TITLES, reason) && typeof TITLES[reason] === "function";
  if (!known) {
    const key = String(reason);
    recordDiagnostic(
      key,
      JSON.stringify({ level: "warn", message: "error-state: unrecognized reason", field: "reason", value: key }),
    );
    return { title: TITLES.unknown(subject), body: BODIES.unknown, reason: "unknown" };
  }
  return { title: TITLES[reason](subject), body: BODIES[reason], reason };
}

export function ErrorState({
  reason,
  subject,
  title,
  body,
  onRetry,
  actions,
  density = "panel",
  live = "assertive",
  testId,
  className,
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);
  const derived = errorStateCopy(reason, subject);
  const resolvedTitle = title ?? derived.title;
  const resolvedBody = body ?? derived.body;

  for (const [field, value] of [
    ["title", title],
    ["body", body],
  ] as const) {
    if (value && RESULT_COUNT_IN_COPY.test(value)) {
      recordDiagnostic(
        `count:${field}:${value}`,
        JSON.stringify({
          level: "warn",
          message: "error-state: a failed request has no count to report",
          field,
          value,
        }),
      );
    }
  }

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // This state is already the failure surface. A rejected retry leaves it
      // on screen rather than escaping as an unhandled rejection.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      data-testid={testId}
      data-reason={derived.reason}
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn(
        "text-sm",
        density === "panel"
          ? "rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-4 sm:p-5"
          : "border-t border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-3 sm:px-4",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Shape as well as hue. A failure that is only a different colour is
            invisible to a reader who cannot separate the two, and an SVG stroke
            survives forced colors where a tinted background does not. */}
        <CircleAlert className="mt-0.5 size-icon-md shrink-0 text-[color:var(--warning)]" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-[color:var(--warning)]">{resolvedTitle}</p>
          <p className="mt-1 leading-6 text-[color:var(--text-muted)]">{resolvedBody}</p>
          {onRetry || actions ? (
            // Wrapping is load-bearing: a call site can pass Retry plus two
            // links, and a non-wrapping row clips the trailing action away on a
            // narrow phone rather than pushing it to a second line.
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry ? (
                <AsyncButton
                  busy={retrying}
                  busyLabel="Retrying…"
                  onClick={retry}
                  // The shared control recipe rather than a hand-rolled copy:
                  // it already carries the `min-h-tap` floor, the focus ring,
                  // the forced-colors border and the disabled treatment.
                  className={cn(floatingControl, "shrink-0")}
                >
                  Retry
                </AsyncButton>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
