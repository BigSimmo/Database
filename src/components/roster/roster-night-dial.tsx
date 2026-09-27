import { modeSummaryMutedText, modeSummarySurface } from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNumberText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";

import { formatDuration, formatShiftRange, shiftTimes } from "./roster-format";

/**
 * Today at 3 am on nights: how much of the night is left, on a 24-hour ring.
 * The ring shows where in the day you are and the part of it this shift
 * covers. It is time, never a score: no colour change, no percentage.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Clockwise from midnight at the top, as a fraction of a day. */
function dayFraction(instant: number): number {
  const perth = instant + 8 * 60 * 60 * 1000;
  return (((perth % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS;
}

function arc(from: number, to: number) {
  const span = (((to - from) % 1) + 1) % 1;
  return {
    strokeDasharray: `${span * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
    transform: `rotate(${from * 360 - 90} 40 40)`,
  };
}

export function RosterNightDial({
  shift,
  now,
  workplace,
  testId = "roster-night-dial",
}: {
  readonly shift: Pick<OnCallShift, "startsAt" | "endsAt">;
  readonly now: Date;
  readonly workplace: string | null;
  readonly testId?: string;
}) {
  const start = Date.parse(shift.startsAt);
  const end = Date.parse(shift.endsAt);
  const at = now.getTime();
  const covered = arc(dayFraction(start), dayFraction(end));
  const done = arc(dayFraction(start), dayFraction(at));
  const { end: endTime } = shiftTimes(shift);
  return (
    <section className={cn(modeSummarySurface, "grid gap-3 p-4")} data-testid={testId} aria-label="Night shift">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
        <h2 className={cn(eyebrowText, modeSummaryMutedText)}>
          {SHIFT_KIND_LABEL.night}
          {workplace ? ` · ${workplace}` : ""}
        </h2>
        <span className={cn(modeNumberText, modeSummaryMutedText, "text-sm")}>{formatShiftRange(shift)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-4">
        <svg viewBox="0 0 80 80" className="size-20 shrink-0" aria-hidden="true">
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="var(--surface-summary-line)" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke="var(--surface-summary-muted)"
            strokeWidth="6"
            strokeLinecap="round"
            {...covered}
          />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke="var(--surface-summary-ink)"
            strokeWidth="6"
            strokeLinecap="round"
            {...done}
          />
        </svg>
        <div className="grid min-w-0 gap-1">
          <span className={cn(modeDisplayNumberText, "text-2xl")} data-testid={`${testId}-left`}>
            {formatDuration(end - at)}
          </span>
          <span className={cn(modeSummaryMutedText, "text-sm")}>left · ends {endTime}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-[color:var(--surface-summary-line)] pt-3">
        <div className="grid gap-0.5">
          <dt className={cn(modeSummaryMutedText, "text-xs")}>Done</dt>
          <dd className={cn(modeNumberText, "text-base-minus")}>{formatDuration(at - start)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className={cn(modeSummaryMutedText, "text-xs")}>Shift</dt>
          <dd className={cn(modeNumberText, "text-base-minus")}>{formatDuration(end - start)}</dd>
        </div>
      </dl>
    </section>
  );
}
