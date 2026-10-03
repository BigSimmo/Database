"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { ModeFeaturedModule } from "@/components/mode-kit/featured-module";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { useRosterShifts } from "@/components/roster/use-roster-shifts";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { describeNextShift } from "@/lib/roster/shifts/next-shift";
import { perthTimeOf } from "@/lib/roster/shifts/perth-time";

/**
 * The shift on now, or the next one, from the reader's own Roster. Renders
 * nothing while loading, signed out, failed, with no shift ahead, or when the
 * shifts are only the sample doctor's example (unless the data is demo mode).
 */
export function MyDayNextShift({ now }: { readonly now: Date }) {
  const state = useRosterShifts();
  if (state.status !== "ready") return null;
  if (state.sample && !state.demoMode) return null;
  const next = describeNextShift(state.shifts, now);
  if (!next) return null;
  const { shift } = next;
  const when = next.onNow
    ? `On now · ends ${perthTimeOf(shift.endsAt)}`
    : next.when.replace(/^Starts/, "starts").replace(/^(Today|Tomorrow)/, (word) => word.toLowerCase());
  const headline = next.onNow ? shift.title : `${shift.title} · ${when}`;
  const place = shift.workplace ?? shift.location;
  return (
    <ModeFeaturedModule mode="my-day" testId="my-day-module-next-shift">
      <Link href="/roster" className={cn(focusRing, "flex min-h-12 items-center justify-between gap-3 rounded-sm p-3")}>
        <span className="grid min-w-0 gap-0.5">
          <span className={eyebrowText}>Next shift</span>
          <span className="break-words text-base-minus font-medium text-[color:var(--text-heading)]">{headline}</span>
          {next.onNow ? <span className={cn(modeSecondaryText, "break-words")}>{when}</span> : null}
          {place ? <span className={cn(modeSecondaryText, "break-words")}>{place}</span> : null}
        </span>
        <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      </Link>
    </ModeFeaturedModule>
  );
}
