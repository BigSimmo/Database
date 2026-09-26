"use client";

import { CalendarSubscribe } from "@/components/calendar/calendar-subscribe";
import { CalendarView } from "@/components/calendar/calendar-view";
import { cn, textMuted } from "@/components/ui-primitives";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { cmeCalendarEvents } from "@/lib/cme/calendar-events";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

/**
 * CALENDAR — CME's dates on one month view: what was logged, when each
 * routine is next due (and every repeat after), and the year's own dates.
 * The routines and year dates can be sent to the owner's own calendar.
 */
export function CmeCalendarPage({
  set,
  entries,
  routines,
  nowIso,
}: {
  set: CmeRequirementSet;
  entries: readonly CmeEntry[];
  routines: readonly CmeRoutine[];
  nowIso: string;
}) {
  const { shown, exported } = cmeCalendarEvents({ set, entries, routines });
  return (
    <main data-testid="cme-calendar" className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Calendar</h1>
      <p className={cn(textMuted, "mb-4 mt-1 text-sm")}>
        What you logged, when your routines come round, and the dates that close the year.
      </p>
      <CalendarView
        events={shown}
        exportEvents={exported}
        today={perthCalendarDate(new Date(nowIso))}
        exportName={`CPD ${set.year}`}
        testId="cme-calendar-view"
      />
      <CalendarSubscribe testId="cme-calendar-subscribe" />
    </main>
  );
}
