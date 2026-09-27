"use client";

import { useId } from "react";

import { cn, textMuted } from "@/components/ui-primitives";
import { formatCmeRowDate } from "@/lib/cme/cpd-year";
import { currentPosition, type TrainingPeriod, type TrainingPosition } from "@/lib/cme/training-timeline";

/**
 * The training timeline, drawn as mode design standard module 7: one
 * horizontal track from the first recorded period to the later of the last
 * end date and today.
 *
 * - Stages sit on a thin upper lane; rotations and breaks on the main lane.
 * - Grey ramp only (`--border` for what is not current or still to come,
 *   `--text-muted` for what is past or the current stage), with the two
 *   exceptions the standard allows: the current rotation in CPD indigo (the
 *   "first data series"), and "now" in product blue.
 * - A break is hatched, the standard's mark for time away.
 * - The drawing is for the eye only (`aria-hidden`). The same facts are in
 *   words under it (the span, where today falls, and a legend), and every
 *   period's own dates are in the list below it on the page.
 *
 * It adds no data: it places the trainee's own periods and
 * `currentPosition` from `training-timeline.ts` on a line, nothing more.
 */

const MS_PER_DAY = 86_400_000;
const TRACK_WIDTH = 100;
const TRACK_HEIGHT = 14;
const STAGE_LANE = { y: 0, height: 3 } as const;
const CLOCK_LANE = { y: 5, height: 9 } as const;
/** A sliver of track between neighbouring periods, so two rotations never read as one. */
const SEGMENT_GAP = 0.4;

type SegmentState = "stage" | "current-stage" | "past" | "current" | "future" | "break";

const GREY_FILL: Record<"stage" | "current-stage" | "past" | "future", string> = {
  stage: "fill-[color:var(--border)]",
  "current-stage": "fill-[color:var(--text-muted)]",
  past: "fill-[color:var(--text-muted)]",
  future: "fill-[color:var(--border)]",
};

function dayNumber(dateOnly: string): number {
  return Math.round(Date.parse(`${dateOnly}T00:00:00Z`) / MS_PER_DAY);
}

function earliest(dates: readonly string[]): string {
  return dates.reduce((first, date) => (date < first ? date : first));
}

function latest(dates: readonly string[]): string {
  return dates.reduce((last, date) => (date > last ? date : last));
}

function segmentState(period: TrainingPeriod, position: TrainingPosition, today: string): SegmentState {
  if (period.kind === "break") return "break";
  if (period.kind === "stage") return position.stage?.id === period.id ? "current-stage" : "stage";
  if (position.rotation?.id === period.id) return "current";
  return period.startsOn > today ? "future" : "past";
}

function nowInWords(position: TrainingPosition, today: string): string {
  const date = formatCmeRowDate(today, today);
  if (position.onBreak && position.breakPeriod) return `Now, ${date}: on a break, ${position.breakPeriod.label}`;
  if (position.rotation) {
    const place =
      position.rotationIndex !== null && position.rotationCount !== null
        ? `, rotation ${position.rotationIndex} of ${position.rotationCount}`
        : "";
    return `Now, ${date}: ${position.rotation.label}${place}`;
  }
  return `Now, ${date}: no rotation covers today`;
}

export function CmeTrainingTimeline({
  periods,
  today,
}: {
  readonly periods: readonly TrainingPeriod[];
  /** Perth calendar date, `YYYY-MM-DD`. */
  readonly today: string;
}) {
  // An SVG pattern id must be a plain name; React's ids carry punctuation.
  const hatchId = `cme-training-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (periods.length === 0) return null;

  const position = currentPosition(periods, today);
  const firstStart = earliest(periods.map((period) => period.startsOn));
  const knownEnds = periods.flatMap((period) => (period.endsOn === null ? [] : [period.endsOn]));
  const ongoing = periods.some((period) => period.endsOn === null);
  const trackEnd = latest([today, ...knownEnds, ...periods.map((period) => period.startsOn)]);
  const origin = dayNumber(firstStart);
  const totalDays = dayNumber(trackEnd) - origin + 1;
  const xOf = (day: number) => ((day - origin) / totalDays) * TRACK_WIDTH;

  const segments = [...periods]
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id))
    .map((period) => {
      const start = dayNumber(period.startsOn);
      const end = dayNumber(period.endsOn ?? trackEnd);
      return {
        period,
        lane: period.kind === "stage" ? STAGE_LANE : CLOCK_LANE,
        x: xOf(start),
        width: Math.max(0, xOf(end + 1) - xOf(start) - SEGMENT_GAP),
        state: segmentState(period, position, today),
      };
    });
  const showNow = today >= firstStart;
  const nowX = xOf(dayNumber(today) + 0.5);
  const hasStage = periods.some((period) => period.kind === "stage");
  const hasOtherRotation = periods.some((period) => period.kind === "rotation" && period.id !== position.rotation?.id);
  const hasBreak = periods.some((period) => period.kind === "break");

  return (
    <figure data-testid="cme-training-timeline" aria-label="Training timeline" className="m-0">
      <svg
        data-testid="cme-training-timeline-track"
        aria-hidden="true"
        viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-3.5 w-full overflow-visible"
      >
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width={1.2} height={1.2} patternTransform="rotate(45)">
            <rect width={1.2} height={1.2} className="fill-[color:var(--surface-raised)]" />
            <rect width={0.4} height={1.2} className="fill-[color:var(--text-muted)]" />
          </pattern>
        </defs>
        {segments.map(({ period, lane, x, width, state }) =>
          state === "current" ? (
            <rect
              key={period.id}
              data-period-id={period.id}
              data-state={state}
              // The attribute sets --mode-identity to CPD indigo on this one shape only.
              data-mode-identity="cme"
              x={x}
              y={lane.y}
              width={width}
              height={lane.height}
              className="fill-[color:var(--mode-identity)]"
            />
          ) : state === "break" ? (
            <rect
              key={period.id}
              data-period-id={period.id}
              data-state={state}
              x={x}
              y={lane.y}
              width={width}
              height={lane.height}
              fill={`url(#${hatchId})`}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="stroke-[color:var(--text-muted)]"
            />
          ) : (
            <rect
              key={period.id}
              data-period-id={period.id}
              data-state={state}
              x={x}
              y={lane.y}
              width={width}
              height={lane.height}
              className={GREY_FILL[state]}
            />
          ),
        )}
        {showNow ? (
          <line
            data-testid="cme-training-timeline-now-marker"
            x1={nowX}
            x2={nowX}
            y1={-1}
            y2={TRACK_HEIGHT + 1}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="stroke-[color:var(--clinical-accent)] forced-colors:stroke-[Highlight]"
          />
        ) : null}
      </svg>
      <figcaption className="mt-3 space-y-1 text-sm">
        <p data-testid="cme-training-timeline-range" className="nums text-[color:var(--text)]">
          {formatCmeRowDate(firstStart, today)} – {ongoing ? "ongoing" : formatCmeRowDate(latest(knownEnds), today)}
        </p>
        <p data-testid="cme-training-timeline-now" className="text-[color:var(--text)]">
          {nowInWords(position, today)}
        </p>
        <ul aria-label="What the timeline shows" className={cn(textMuted, "flex flex-wrap gap-x-4 gap-y-1 pt-1")}>
          {position.rotation ? (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                data-mode-identity="cme"
                className="h-2 w-3 rounded-sm bg-[color:var(--mode-identity)]"
              />
              This rotation
            </li>
          ) : null}
          {hasOtherRotation ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-3 rounded-sm bg-[color:var(--text-muted)]" />
              Other rotations
            </li>
          ) : null}
          {hasStage ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1 w-3 rounded-sm bg-[color:var(--text-muted)]" />
              Stages, top line
            </li>
          ) : null}
          {hasBreak ? (
            <li className="flex items-center gap-1.5">
              <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 rounded-sm">
                <rect width={12} height={8} fill={`url(#${hatchId})`} />
              </svg>
              Break
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-[color:var(--clinical-accent)]" />
            Now
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
