"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CalendarView } from "@/components/calendar/calendar-view";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeActionButton } from "@/components/mode-kit/action-button";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { modeNumberText } from "@/components/mode-kit/type";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, primaryControl } from "@/components/ui-primitives";
import type { CalendarEvent } from "@/lib/calendar/calendar-event";
import { isWorkedKind, SHIFT_KIND_LABEL, SHIFT_LETTER } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { addDaysToDate, formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";

import { RosterAddSheet, type RosterAddView } from "./roster-add-sheet";
import { formatDateSpan, formatHours, formatShiftRange, kindOf, useRosterNow } from "./roster-format";
import { RosterHoursPanel, type RosterExtraTime } from "./roster-hours-panel";
import { RosterImportFlow } from "./roster-import-flow";
import { RosterLetter, RosterWeekChart } from "./roster-week-strip";
import { useRosterLinks } from "./use-roster-links";
import { useRosterSettings } from "./use-roster-settings";
import { useRosterShifts } from "./use-roster-shifts";

/**
 * Roster Shifts: Week (a 24-hour chart and every shift in words), Month
 * (the shared calendar), Hours (the fortnight). "+ Add" opens one sheet with
 * three ways in. A night belongs to the day it starts and ends "+1".
 */

type View = "week" | "month" | "hours";

const VIEWS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "hours", label: "Hours" },
] as const;

function mondayOf(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysToDate(date, -weekday);
}

function hoursOf(shift: OnCallShift): number {
  return (Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / (60 * 60 * 1000);
}

/** Shifts as calendar events: the letter and kind as the title, no place. */
function toCalendarEvents(shifts: readonly OnCallShift[]): CalendarEvent[] {
  return shifts.map((shift) => {
    const kind = kindOf(shift);
    return {
      id: `roster-${shift.id}`,
      title: `${SHIFT_LETTER[kind]} · ${SHIFT_KIND_LABEL[kind]}`,
      date: perthDateOf(shift.startsAt),
      startTime: perthTimeOf(shift.startsAt),
      durationMinutes: Math.round(hoursOf(shift) * 60),
      kind: "other",
    };
  });
}

function WeekView({
  shifts,
  now,
  onRemoveSeries,
}: {
  readonly shifts: readonly OnCallShift[];
  readonly now: Date;
  readonly onRemoveSeries: (seriesId: string) => void;
}) {
  const [monday, setMonday] = useState(() => mondayOf(perthDateOf(now)));
  const sunday = addDaysToDate(monday, 6);
  const inWeek = shifts
    .filter((shift) => {
      const date = perthDateOf(shift.startsAt);
      return date >= monday && date <= sunday;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const total = inWeek.filter((shift) => isWorkedKind(kindOf(shift))).reduce((sum, shift) => sum + hoursOf(shift), 0);

  return (
    <div className="grid min-w-0 gap-4" data-testid="roster-shifts-week">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <ModeActionButton
          icon={ChevronLeft}
          label="Previous week"
          onClick={() => setMonday(addDaysToDate(monday, -7))}
        />
        <h2 className={cn(modeNumberText, "text-base-minus text-[color:var(--text-heading)]")}>
          {formatDateSpan(monday, sunday)} · {formatHours(Math.round(total * 100) / 100)}
        </h2>
        <ModeActionButton icon={ChevronRight} label="Next week" onClick={() => setMonday(addDaysToDate(monday, 7))} />
      </div>
      <RosterWeekChart monday={monday} shifts={shifts} now={now} testId="roster-shifts-week-chart" />
      <ModeGroupedList testId="roster-shifts-agenda">
        {inWeek.length === 0 ? (
          <ModeRow title="No shifts this week" />
        ) : (
          inWeek.map((shift) => {
            const kind = kindOf(shift);
            const place = shift.workplace ?? shift.location;
            return (
              <ModeRow
                key={shift.id}
                testId="roster-shifts-row"
                title={
                  <span className="flex min-w-0 items-center gap-2">
                    <RosterLetter kind={kind} />
                    {formatPerthDay(perthDateOf(shift.startsAt))}
                  </span>
                }
                subtitle={`${SHIFT_KIND_LABEL[kind]}${place ? ` · ${place}` : ""}`}
                trailing={
                  <>
                    <span className={cn(modeNumberText, "text-base-minus text-[color:var(--text)]")}>
                      {formatShiftRange(shift)}
                    </span>
                    {shift.source === "manual" && shift.seriesId ? (
                      <ModeActionButton
                        icon={Trash2}
                        label={`Remove ${SHIFT_KIND_LABEL[kind]} on ${formatPerthDay(perthDateOf(shift.startsAt))} and its repeats`}
                        onClick={() => onRemoveSeries(shift.seriesId!)}
                      />
                    ) : null}
                  </>
                }
              />
            );
          })
        )}
      </ModeGroupedList>
    </div>
  );
}

export function RosterShiftsPage({ now: pinnedNow }: { readonly now?: Date } = {}) {
  const now = useRosterNow(pinnedNow);
  const shifts = useRosterShifts();
  const links = useRosterLinks();
  const settings = useRosterSettings();
  const [view, setView] = useState<View>("week");
  const [addView, setAddView] = useState<RosterAddView | null>(null);
  const [importing, setImporting] = useState(false);
  const [extras, setExtras] = useState<readonly RosterExtraTime[]>([]);
  const [notice, setNotice] = useState<{ tone: "neutral" | "warning"; text: string } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  const today = perthDateOf(now);
  const events = useMemo(() => toCalendarEvents(shifts.shifts), [shifts.shifts]);
  const workplaces = useMemo(
    () => [...new Set(shifts.shifts.flatMap((shift) => (shift.workplace ? [shift.workplace] : [])))],
    [shifts.shifts],
  );
  const canEdit = shifts.status === "ready" && !shifts.demoMode;

  async function removeSeries(seriesId: string) {
    const failure = await shifts.removeSeries(seriesId);
    setNotice(failure ? { tone: "warning", text: failure } : { tone: "neutral", text: "Removed" });
  }

  return (
    <InformationPageShell testId="roster-shifts-main" width="narrow">
      <h1 className="sr-only">Shifts</h1>
      {importing ? (
        <RosterImportFlow
          shifts={shifts}
          settings={settings}
          today={today}
          onClose={() => setImporting(false)}
          onSaved={() => {
            setImporting(false);
            setNotice({ tone: "neutral", text: "Saved" });
          }}
        />
      ) : (
        <div className="grid min-w-0 gap-5 pb-20">
          <SegmentedControl label="View" value={view} onChange={setView} options={VIEWS} layout="equal" />

          {shifts.status === "loading" ? (
            <ModeModuleSkeleton rows={5} twoLine testId="roster-shifts-loading" />
          ) : shifts.status === "signed-out" ? (
            <ModeNotice testId="roster-shifts-signed-out">Sign in to see your roster.</ModeNotice>
          ) : shifts.status === "error" ? (
            <ModeNotice tone="warning">Your shifts could not be loaded. Try again later.</ModeNotice>
          ) : (
            <>
              {shifts.demoMode ? <ModeNotice>Example only. Sign in to add your own shifts.</ModeNotice> : null}
              {notice ? <ModeNotice tone={notice.tone}>{notice.text}</ModeNotice> : null}
              {view === "week" ? (
                <WeekView shifts={shifts.shifts} now={now} onRemoveSeries={(id) => void removeSeries(id)} />
              ) : view === "month" ? (
                <CalendarView events={events} today={today} exportName="Roster" testId="roster-shifts-month" />
              ) : (
                <RosterHoursPanel
                  shifts={shifts.shifts}
                  now={now}
                  extras={extras}
                  onExtra={(extra) => setExtras((current) => [...current, extra])}
                />
              )}
            </>
          )}
        </div>
      )}

      {!importing && canEdit ? (
        <button
          ref={addButton}
          type="button"
          data-testid="roster-add-button"
          onClick={() => setAddView("menu")}
          className={cn(
            primaryControl,
            "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[var(--z-chrome)] rounded-full shadow-[var(--e4)] print:hidden",
          )}
        >
          <Plus aria-hidden="true" className="size-icon-sm" />
          Add
        </button>
      ) : null}

      <RosterAddSheet
        open={addView !== null}
        view={addView ?? "menu"}
        onViewChange={setAddView}
        onClose={() => setAddView(null)}
        today={today}
        workplaces={workplaces}
        onImportFile={() => {
          setAddView(null);
          setImporting(true);
        }}
        onAddShift={async (request) => {
          const failure = await shifts.addManual(request);
          if (!failure) {
            setAddView(null);
            setNotice({ tone: "neutral", text: "Saved" });
          }
          return failure;
        }}
        onAddLink={async (url, workplace) => {
          const failure = await links.add(url, workplace);
          if (!failure) {
            setAddView(null);
            setNotice({ tone: "neutral", text: "Saved" });
          }
          return failure;
        }}
      />
    </InformationPageShell>
  );
}
