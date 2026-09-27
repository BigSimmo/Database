"use client";

import type { ReactNode } from "react";

import { modeSummarySurface } from "@/components/mode-kit/recipes";
import { modeDisplayNumberText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";
import { formatCalendarDateShort } from "@/lib/cme/cpd-year";
import { cmeSeasonLine, cmeTargetReachedOn, cmeWeeklyPace } from "@/lib/cme/pace";
import type { CmeEntry } from "@/lib/cme/types";

/**
 * TODAY'S HERO SUMMARY: mode design standard module 8, used once in CPD.
 *
 * Four lines, each readable in two seconds:
 *   1. the season and the year's end ("Last quarter · year ends 31 Dec 2026, in 13 weeks");
 *   2. hours logged against the target ("32.5 of 50 h"), the page's one
 *      40 px figure at weight 300;
 *   3. a thin bar of the same two numbers, with no pace tick, no percentage and
 *      no ahead-or-behind colour, because each of those would grade the doctor;
 *   4. the pace line ("About 1.3 h a week reaches 50 h by 31 Dec"; in the last
 *      six days "17.5 h to go by 31 Dec"; none once the year is closed), or,
 *      once the target is reached, the day it was reached ("50 h reached on 12 Nov").
 *
 * The panel is dark in both themes through the shared `--surface-summary*`
 * tokens: the command fill in light mode, `--surface-lux` with a hairline in
 * dark mode. The bar's fill is the hero's one graphic in CPD indigo
 * (`--cme-hero-fill`); every word stays neutral. The bar is hidden from screen
 * readers because line 2 already says the same thing in words.
 */

export type CmeHeroSummaryProps = {
  readonly year: number;
  /** Perth calendar date, `YYYY-MM-DD`. */
  readonly today: string;
  /** Hours logged this year, archived activities excluded (`evaluateYear`'s `totalHours`). */
  readonly loggedHours: number;
  readonly targetHours: number;
  /** The year's activities, for the day the target was reached. */
  readonly entries: readonly CmeEntry[];
  /** The year is closed (`set.closedAt`): no pace line, since nothing more is asked of it. */
  readonly closed?: boolean;
  /** When given, the whole panel is one button that opens the hours detail. */
  readonly onOpenDetail?: () => void;
};

/** The kit's dark summary panel at the 16 px panel radius (spec §7.1, standard module 8). */
const PANEL = cn(modeSummarySurface, "rounded-xl");

/** The one display figure: 40 px at 300 (the kit's recipe). */
const FIGURE = cn(modeDisplayNumberText, "text-display text-[color:var(--surface-summary-ink)]");

/** "32.5", "50", "0": never "32.50". */
function formatHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

function paceLine({ year, today, loggedHours, targetHours, entries, closed }: CmeHeroSummaryProps): string | null {
  if (targetHours > 0 && loggedHours >= targetHours) {
    const reachedOn = cmeTargetReachedOn(
      entries.filter((entry) => entry.date.startsWith(`${year}-`)),
      targetHours,
    );
    return reachedOn ? `${formatHours(targetHours)} h reached on ${formatCalendarDateShort(reachedOn)}` : null;
  }
  // A closed year asks nothing more of the doctor, so it shows no pace.
  if (closed) return null;
  const pace = cmeWeeklyPace({ targetHours, loggedHours, today, year });
  if (!pace) return null;
  // Fewer than 7 days left (from 25 Dec): a weekly figure would overstate it ("About 17.5 h a week"
  // on 31 Dec), so say what is left instead.
  if (pace.weeksLeft < 1) return `${formatHours(targetHours - loggedHours)} h to go by 31 Dec`;
  return `About ${pace.weeklyHours.toFixed(1)} h a week reaches ${formatHours(targetHours)} h by 31 Dec`;
}

export function CmeHeroSummary(props: CmeHeroSummaryProps) {
  const { year, today, loggedHours, targetHours, onOpenDetail } = props;
  const fraction = targetHours > 0 ? Math.min(1, Math.max(0, loggedHours / targetHours)) : 0;
  const pace = paceLine(props);

  // Spans, not paragraphs: the same lines sit inside a <button> when the panel opens the detail.
  const body: ReactNode = (
    <>
      <span data-testid="cme-hero-season" className="block text-sm text-[color:var(--surface-summary-muted)]">
        {cmeSeasonLine({ year, today })}
      </span>
      <span data-testid="cme-total-hours" className="mt-1 block">
        <span className={FIGURE}>{formatHours(loggedHours)}</span>
        <span className="text-base-minus text-[color:var(--surface-summary-muted)]">{` of ${formatHours(targetHours)} h`}</span>
      </span>
      <svg
        data-testid="cme-hero-bar"
        aria-hidden="true"
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        className="mt-3 block h-1 w-full overflow-hidden rounded-full"
      >
        <rect
          x={0}
          y={0}
          width={100}
          height={4}
          className="fill-[color:var(--surface-summary-line)] forced-colors:fill-[GrayText]"
        />
        <rect
          data-testid="cme-hero-bar-fill"
          x={0}
          y={0}
          width={Math.round(fraction * 1000) / 10}
          height={4}
          className="fill-[color:var(--cme-hero-fill)] forced-colors:fill-[CanvasText]"
        />
      </svg>
      {pace ? (
        <span data-testid="cme-pace-sentence" className="mt-3 block text-sm">
          {pace}
        </span>
      ) : null}
    </>
  );

  return (
    <section
      data-testid="cme-hero-summary"
      aria-label={`CPD hours for ${year}`}
      className={cn(PANEL, !onOpenDetail && "p-4")}
    >
      {onOpenDetail ? (
        <button
          type="button"
          onClick={onOpenDetail}
          className="block min-h-12 w-full rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          {body}
        </button>
      ) : (
        body
      )}
    </section>
  );
}
