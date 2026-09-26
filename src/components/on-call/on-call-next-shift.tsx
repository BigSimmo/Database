"use client";

import { BriefcaseMedical, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cardSurface, focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";
import { describeRosterChangeCounts, type OnCallShiftsState } from "@/components/on-call/use-on-call-shifts";
import { describeNextShift } from "@/lib/on-call/shifts/next-shift";
import { formatPerthDay, perthDateOf } from "@/lib/on-call/shifts/perth-time";

/**
 * The top of the On Call home: the shift on now, or the next one.
 *
 * Quiet when there is nothing to say. Signed out, loading or failed, it draws
 * nothing at all, so the home reads exactly as it did before rosters existed;
 * with no shifts it is one line inviting the import.
 */
export function OnCallNextShift({ state, now }: { state: OnCallShiftsState; now: Date }) {
  if (state.status !== "ready") return null;
  const next = describeNextShift(state.shifts, now);
  const unseenChange =
    state.latestImport &&
    !state.latestImport.seenAt &&
    state.latestImport.added + state.latestImport.changed + state.latestImport.removed > 0
      ? state.latestImport
      : null;

  if (!next) {
    return (
      <Link
        href="/on-call/shifts"
        data-testid="on-call-next-shift-empty"
        className={cn(
          cardSurface,
          focusRing,
          "flex min-h-tap items-center justify-between gap-3 p-3 text-sm no-underline",
        )}
      >
        <span className="flex items-center gap-2 font-semibold text-[color:var(--text)]">
          <BriefcaseMedical aria-hidden="true" className="size-icon-sm" />
          {state.shifts.length === 0 ? "Add your roster" : "No shifts coming up"}
        </span>
        <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
      </Link>
    );
  }

  const { shift } = next;
  return (
    <Link
      href="/on-call/shifts"
      data-testid="on-call-next-shift"
      className={cn(cardSurface, focusRing, "grid min-h-tap gap-1 p-4 no-underline")}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            next.onNow ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {next.onNow ? "On shift" : "Next shift"}
        </span>
        <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
      </span>
      <span className="text-base font-bold text-[color:var(--text-heading)]" data-testid="on-call-next-shift-when">
        {next.when}
      </span>
      <span className="text-sm text-[color:var(--text)]">
        {formatPerthDay(perthDateOf(shift.startsAt))}, {next.hours}
      </span>
      <span className={cn(textMuted, "break-words text-sm")}>
        {shift.title}
        {shift.location ? ` · ${shift.location}` : ""}
      </span>
      {unseenChange ? (
        <span className="text-sm font-semibold text-[color:var(--text)]" data-testid="on-call-next-shift-changed">
          Roster changed: {describeRosterChangeCounts(unseenChange)}
        </span>
      ) : null}
    </Link>
  );
}
