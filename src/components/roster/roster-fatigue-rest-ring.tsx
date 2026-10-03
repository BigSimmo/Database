"use client";

import { ArrowLeftRight, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { focusRing } from "@/components/card-recipes";
import { modeSummaryMutedText, modeSummarySurface } from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNumberText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { formatDuration } from "./roster-format";

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MIN_SAFE_REST_HOURS = 10;
const MIN_SAFE_REST_MS = MIN_SAFE_REST_HOURS * 60 * 60 * 1000;

export function calculateRestTurnaround(
  shifts: readonly Pick<OnCallShift, "id" | "startsAt" | "endsAt">[],
  now: Date,
): {
  readonly restRemainingMs: number | null;
  readonly totalTurnaroundMs: number | null;
  readonly isBreach: boolean;
  readonly nextShift: Pick<OnCallShift, "id" | "startsAt" | "endsAt"> | null;
  readonly previousShift: Pick<OnCallShift, "id" | "startsAt" | "endsAt"> | null;
} {
  const at = now.getTime();
  const sorted = [...shifts].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  // Find next upcoming shift
  const nextShift = sorted.find((s) => Date.parse(s.startsAt) > at) ?? null;
  if (!nextShift) {
    return { restRemainingMs: null, totalTurnaroundMs: null, isBreach: false, nextShift: null, previousShift: null };
  }

  // Find shift immediately preceding nextShift
  const nextStart = Date.parse(nextShift.startsAt);
  const previousShift =
    [...sorted].reverse().find((s) => Date.parse(s.endsAt) <= nextStart && s.id !== nextShift.id) ?? null;

  if (!previousShift) {
    return { restRemainingMs: null, totalTurnaroundMs: null, isBreach: false, nextShift, previousShift: null };
  }

  const previousEnd = Date.parse(previousShift.endsAt);
  const totalTurnaroundMs = Math.max(0, nextStart - previousEnd);
  const restRemainingMs = Math.max(0, nextStart - at);
  const isBreach = totalTurnaroundMs > 0 && totalTurnaroundMs < MIN_SAFE_REST_MS;

  return { restRemainingMs, totalTurnaroundMs, isBreach, nextShift, previousShift };
}

export function RosterFatigueRestRing({
  shifts,
  now,
  testId = "roster-fatigue-rest-ring",
}: {
  readonly shifts: readonly Pick<OnCallShift, "id" | "startsAt" | "endsAt">[];
  readonly now: Date;
  readonly testId?: string;
}) {
  const turnaround = useMemo(() => calculateRestTurnaround(shifts, now), [shifts, now]);

  if (turnaround.restRemainingMs === null) {
    return null;
  }

  const { restRemainingMs, totalTurnaroundMs, isBreach } = turnaround;
  const hoursRemaining = (restRemainingMs / (60 * 60 * 1000)).toFixed(1);

  // Ratio of turnaround rest remaining (clamped 0 to 1)
  const totalMs = totalTurnaroundMs && totalTurnaroundMs > 0 ? totalTurnaroundMs : 24 * 60 * 60 * 1000;
  const fraction = Math.max(0, Math.min(1, restRemainingMs / totalMs));
  const strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <section
      data-testid={testId}
      aria-label="Circadian rest and fatigue"
      className={cn(
        modeSummarySurface,
        "grid gap-3.5 p-4 rounded-xl border border-[color:var(--border)] transition-colors",
        isBreach
          ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]"
          : "bg-[image:radial-gradient(circle_at_100%_0%,color-mix(in_oklab,var(--mode-identity)_35%,transparent),transparent_70%)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn(eyebrowText, modeSummaryMutedText, "flex items-center gap-1.5")}>
          <Clock className="size-3.5" aria-hidden="true" />
          Recovery & Safe Hours
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
            isBreach
              ? "border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]"
              : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
          )}
        >
          {isBreach ? (
            <>
              <TriangleAlert className="size-3" aria-hidden="true" />
              {"< 10 h turnaround"}
            </>
          ) : (
            <>
              <ShieldCheck className="size-3" aria-hidden="true" />
              10 h safe recovery interval
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Circular SVG Gauge */}
        <div className="relative grid size-20 shrink-0 place-items-center">
          <svg viewBox="0 0 90 90" className="size-20 -rotate-90 transform" aria-hidden="true">
            <circle cx="45" cy="45" r={RADIUS} fill="none" stroke="var(--surface-summary-line)" strokeWidth="5" />
            <circle
              cx="45"
              cy="45"
              r={RADIUS}
              fill="none"
              stroke={isBreach ? "var(--warning-text)" : "var(--tone-indigo)"}
              strokeWidth="5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <span className={cn(modeDisplayNumberText, "text-base font-normal tracking-tight")}>{hoursRemaining}h</span>
          </div>
        </div>

        {/* Text Details & Action */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(modeNumberText, "text-base-minus font-normal text-[color:var(--text-heading)]")}>
              {formatDuration(restRemainingMs)}
            </span>
            <span className={cn(modeSummaryMutedText, "text-xs")}>rest remaining</span>
          </div>
          <p className="text-2xs text-[color:var(--text-muted)] leading-tight">
            {isBreach
              ? "This shift turnaround is under the recommended 10-hour safe recovery window."
              : "Circadian recovery interval before your next rostered shift starts."}
          </p>

          {isBreach && (
            <div className="mt-1">
              <Link
                href="/roster/swaps"
                className={cn(
                  "inline-flex min-h-tap items-center gap-1.5 rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-medium text-[color:var(--warning-text)] hover:bg-[color:var(--warning-bg)]",
                  focusRing,
                )}
              >
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                Find a swap
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
