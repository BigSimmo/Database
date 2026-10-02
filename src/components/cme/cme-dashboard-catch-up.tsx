"use client";

import { ChevronRight } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { formatCmeHours } from "@/components/cme/cme-dashboard-next-step";
import { cn, textMuted } from "@/components/ui-primitives";
import type { CmeCatchUpPlan } from "@/lib/cme/catch-up-plan";

/**
 * TODAY'S CATCH-UP PLANNER CARD: the hours still to reach the year's total,
 * split into what the owner's own routines would likely add by 31 December
 * and what is still to find, as a weekly figure.
 *
 * It is an estimate, and says so on the card: a routine is a reminder to log
 * something, never a log of it. Pace is a number ("0.9 h a week"), never
 * "ahead" or "behind". The bar is drawn in the mode's ink and accent tokens
 * against the inset track — no status colour — and each part is also a row
 * in words, so the bar is only for the eye.
 *
 * Rendered only while the plan has something to plan (`status: "plan"`):
 * once the total is reached, the hero already says when, and a year that has
 * ended asks nothing more.
 */
export function CmeCatchUpCard({
  plan,
  showWeekly,
  onOpenDetail,
}: {
  plan: CmeCatchUpPlan;
  /** False in the first weeks of the year and its last week, when the hero shows no weekly pace either. */
  showWeekly: boolean;
  /** Opens the routine scenarios behind the estimate. */
  onOpenDetail: () => void;
}) {
  if (plan.status !== "plan") return null;
  const scale = Math.max(plan.targetHours, plan.hoursLogged + plan.routineCoverHours, 1);
  const loggedWidth = (Math.min(plan.hoursLogged, scale) / scale) * 100;
  const routineWidth = (plan.routineCoverHours / scale) * 100;

  return (
    <section
      data-testid="cme-catch-up"
      aria-labelledby="cme-catch-up-heading"
      className={cn(cardSurface, "flex flex-col p-4")}
    >
      <h2 id="cme-catch-up-heading" className="text-base font-semibold text-[color:var(--text)]">
        {`To reach ${formatCmeHours(plan.targetHours)} h by 31 Dec`}
      </h2>
      <div
        data-testid="cme-catch-up-bar"
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)] shadow-[var(--shadow-inset)]"
      >
        <svg aria-hidden="true" viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-full w-full">
          <rect
            x={0}
            y={0}
            height={10}
            width={loggedWidth}
            className="fill-[color:var(--command)] forced-colors:fill-[CanvasText]"
          />
          <rect
            x={loggedWidth}
            y={0}
            height={10}
            width={routineWidth}
            className="fill-[color:var(--clinical-accent)] forced-colors:fill-[GrayText]"
          />
        </svg>
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm text-[color:var(--text)]">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[color:var(--command)]" />
            Logged
          </dt>
          <dd data-testid="cme-catch-up-logged-hours" className="nums font-normal">
            {`${formatCmeHours(plan.hoursLogged)} h`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]" />
            Routines likely
          </dt>
          <dd data-testid="cme-catch-up-routine-hours" className="nums font-normal">
            {`≈ ${formatCmeHours(plan.routineEstimateHours)} h`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-inset)]"
            />
            Still to find
          </dt>
          <dd data-testid="cme-catch-up-remaining-hours" className="nums font-normal">
            {`${formatCmeHours(plan.remainingAfterRoutines)} h`}
            {showWeekly && plan.remainingAfterRoutines > 0 ? ` · ${plan.hoursPerWeek.toFixed(1)} h a week` : null}
          </dd>
        </div>
      </dl>
      {plan.biggestGap ? (
        <p data-testid="cme-catch-up-gap" className="mt-3 text-sm text-[color:var(--text)]">
          Biggest gap: {plan.biggestGap.label} <span className="nums">({plan.biggestGap.summary})</span>
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <p className={cn(textMuted, "text-xs")}>Estimate from your routines</p>
        <button
          type="button"
          data-testid="cme-close-gap"
          onClick={onOpenDetail}
          className="inline-flex min-h-tap shrink-0 items-center gap-1 text-sm text-[color:var(--text)] underline underline-offset-2"
        >
          Close the gap
          <ChevronRight aria-hidden="true" className="size-icon-sm" />
        </button>
      </div>
    </section>
  );
}
