"use client";

import { useClientTime } from "@/lib/use-client-time";
import { cn } from "@/components/ui-primitives";
import { MissingValue, type MissingValueReason } from "@/components/ui/missing-value";

/**
 * COMPONENTS §8. Every date a clinician reads goes through here so that three
 * things cannot drift per call site: the display locale/timezone, whether a
 * relative form is allowed, and what an absent date looks like.
 *
 * `formatClinicalDate()` in `src/lib/source-metadata.ts` stays the formatter for
 * provenance *strings* (the clipboard audit line cannot contain an element).
 * Both use en-AU / Australia/Perth; `tests/ui-v2-answer-safety.dom.test.tsx`
 * pins that they agree, so the two paths cannot diverge silently.
 */

export type DateDisplayKind = "review" | "generated" | "event";

export type DateDisplayProps = {
  /** ISO only. Preformatted display strings are unrepresentable. */
  value: string | null | undefined;
  /** Review/expiry dates are always absolute; "event" may carry a relative companion. */
  kind: DateDisplayKind;
  /** Screen only; renders beside the absolute, never instead of it. */
  relative?: boolean;
  /** Rendered via MissingValue when value is absent. */
  missingReason?: MissingValueReason;
  className?: string;
};

const DATE_ONLY = { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Perth" } as const;
const DATE_TIME = { ...DATE_ONLY, hour: "2-digit", minute: "2-digit", hour12: false } as const;

/**
 * `2026-03-14` carries no time. Formatting it with hour+minute would print
 * `14/03/2026, 08:00` — a precision that was never recorded, invented on a
 * provenance strip a clinician is being asked to trust.
 */
const DATE_ONLY_ISO = /^\d{4}-\d{2}-\d{2}$/;

const loggedInvalidValues = new Set<string>();

function noteInvalid(value: string) {
  if (loggedInvalidValues.has(value)) return;
  loggedInvalidValues.add(value);
  if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
    console.warn(
      JSON.stringify({ level: "warn", message: "date-display: unparseable ISO value", field: "value", value }),
    );
  }
}

/** The Perth calendar day as `YYYY-MM-DD`, so "days ago" counts days, not 24-hour blocks. */
function perthCalendarDay(instant: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function calendarDayDelta(from: Date, to: Date) {
  const start = Date.parse(`${perthCalendarDay(from)}T00:00:00.000Z`);
  const end = Date.parse(`${perthCalendarDay(to)}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function relativeCalendarPhrase(value: Date, now: Date) {
  const days = calendarDayDelta(now, value);
  const format = new Intl.RelativeTimeFormat("en-AU", { numeric: "auto" });
  if (Math.abs(days) < 31) return format.format(days, "day");
  if (Math.abs(days) < 365) return format.format(Math.round(days / 30), "month");
  return format.format(Math.round(days / 365), "year");
}

export function DateDisplay({
  value,
  kind,
  relative = false,
  missingReason = "not_recorded",
  className,
}: DateDisplayProps) {
  // Always called: the relative companion is client-only so that server and
  // client render the same absolute date and hydration cannot mismatch on a
  // clock tick. `0` is the pre-mount sentinel from useClientTime.
  const now = useClientTime();

  const trimmed = typeof value === "string" ? value.trim() : "";
  const parsed = trimmed ? new Date(trimmed) : null;
  const valid = parsed !== null && Number.isFinite(parsed.getTime());

  if (!trimmed) return <MissingValue reason={missingReason} className={className} />;
  if (!valid) {
    noteInvalid(trimmed);
    return <MissingValue reason="unknown" className={className} />;
  }

  const withTime = kind === "generated" && !DATE_ONLY_ISO.test(trimmed);
  const absolute = new Intl.DateTimeFormat("en-AU", withTime ? DATE_TIME : DATE_ONLY).format(parsed);
  // A review date is a commitment, not an ambience — it never softens into
  // "in about a month". `generated` is a fixed stamp of this answer's run.
  const relativeAllowed = relative && kind === "event" && now > 0;

  return (
    <span data-testid="date-display" data-kind={kind} className={cn("nums", className)}>
      <time dateTime={trimmed}>{absolute}</time>
      {relativeAllowed ? (
        // Never in print: a printout is a snapshot, and "2 days ago" on paper is
        // relative to a moment the reader cannot recover (SPEC §4.12).
        <span data-testid="date-display-relative" className="ml-1 text-[color:var(--text-muted)] print:hidden">
          ({relativeCalendarPhrase(parsed, new Date(now))})
        </span>
      ) : null}
    </span>
  );
}
