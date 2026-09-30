"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { modeInsetHairline, modePressable } from "@/components/mode-kit/recipes";
import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";
import { RosterSentBar, type SentReceipt } from "@/components/roster/requests/roster-sent-bar";
import { formatShiftRange } from "@/components/roster/roster-format";
import { SwapFlowSheet } from "@/components/roster/swaps/swap-flow-sheet";
import { postRosterAction, useRosterRead } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import {
  calendarStateQuery,
  calendarWindow,
  filterAssignments,
  readCalendarState,
  stepCalendar,
  type CalendarShow,
  type CalendarState,
  type CalendarView,
} from "@/lib/roster/team/calendar-model";
import type { RosterAssignment, RosterTeam } from "@/lib/roster/team/model";
import { assignmentStartDate } from "@/lib/roster/team/team-view";

import { CalendarFilters, type CalendarPerson } from "./calendar-filters";
import { DayView } from "./day-view";
import { ShiftSheet } from "./shift-sheet";

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];
const UNIT: Record<CalendarView, string> = { month: "month", week: "week", day: "day" };

function heading(state: CalendarState): string {
  if (state.view === "day") return formatPerthDay(state.date);
  if (state.view === "week") return `Week of ${formatPerthDay(calendarWindow(state).from)}`;
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${state.date}T00:00:00Z`),
  );
}

function peopleIn(rows: readonly RosterAssignment[]): CalendarPerson[] {
  const seen = new Map<string, CalendarPerson>();
  for (const row of rows) {
    if (row.userId && !seen.has(row.userId))
      seen.set(row.userId, { userId: row.userId, name: row.name ?? "Name not available" });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Month and Week views arrive in later tasks. Until then both show the
 * filtered shifts as a list by the day each one starts, so the page stays usable.
 */
function ShiftsByDay({
  rows,
  actorId,
  onSelect,
}: {
  rows: readonly RosterAssignment[];
  actorId: string | null;
  onSelect: (shift: RosterAssignment) => void;
}) {
  const days = [...new Set(rows.map(assignmentStartDate))].sort();
  if (!days.length) return <p>No shifts in this period.</p>;
  return (
    <>
      {days.map((date) => (
        <ModeGroupedList key={date} eyebrow={formatPerthDay(date)} mode="roster">
          {rows
            .filter((row) => assignmentStartDate(row) === date)
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
            .map((row) => (
              <li key={row.id} className={cn(modeInsetHairline, "flex min-w-0")}>
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className={cn(
                    modePressable,
                    focusRing,
                    "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-1 text-left",
                  )}
                >
                  <span className="break-words font-medium">
                    {row.userId === actorId ? "You" : (row.name ?? "Name not available")}
                  </span>
                  <span className="nums shrink-0 text-sm">{formatShiftRange(row)}</span>
                </button>
              </li>
            ))}
        </ModeGroupedList>
      ))}
    </>
  );
}

type RequestSheet = { kind: "swap" | "give_away"; shift: RosterAssignment } | null;

/**
 * The team calendar. View, date and filter live in the URL and are written
 * with `router.replace`, so stepping around never piles up history and
 * nothing about the roster is kept on the device.
 */
export function TeamCalendar({ team, actorId, now }: { team: RosterTeam; actorId: string | null; now: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = perthDateOf(now);
  const state = readCalendarState(params, today);
  const overview = useRosterRead(team.serviceId, "overview");
  const read = useRosterRead(team.serviceId, "assignments", calendarWindow(state));
  const reload = read.reload;
  const [selected, setSelected] = useState<RosterAssignment | null>(null);
  const [request, setRequest] = useState<RequestSheet>(null);
  const [sent, setSent] = useState<SentReceipt | null>(null);
  const clearSent = useCallback(() => setSent(null), []);
  const marked = useRef<string | null>(null);
  const publication = overview.data?.latestPublication;
  useEffect(() => {
    if (!publication || overview.data?.seenLatest || marked.current === publication.id) return;
    marked.current = publication.id;
    void postRosterAction(team.serviceId, { action: "seen.mark", publicationId: publication.id });
  }, [publication, overview.data?.seenLatest, team.serviceId]);

  function go(next: CalendarState) {
    router.replace(`${pathname}?${calendarStateQuery(next)}`, { scroll: false });
  }
  const onSent = useCallback(
    (message: string, undo?: () => Promise<void>) => {
      setSent({
        message,
        undo: undo
          ? async () => {
              await undo();
              reload();
            }
          : undefined,
      });
      reload();
    },
    [reload],
  );

  const all = read.data?.assignments ?? [];
  const rows = filterAssignments(all, state.show, actorId);
  const unit = UNIT[state.view];
  return (
    <>
      <SegmentedControl
        label="View"
        layout="equal"
        value={state.view}
        onChange={(view) => go({ ...state, view })}
        options={VIEWS}
      />
      <CalendarFilters
        show={state.show}
        canFilterToMe={actorId !== null}
        people={peopleIn(all)}
        onChange={(show: CalendarShow) => go({ ...state, show })}
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="min-h-12"
          aria-label={`Previous ${unit}`}
          onClick={() => go(stepCalendar(state, -1))}
        >
          ‹
        </Button>
        <h1 className="text-base font-normal">{heading(state)}</h1>
        <Button
          variant="ghost"
          className="min-h-12"
          aria-label={`Next ${unit}`}
          onClick={() => go(stepCalendar(state, 1))}
        >
          ›
        </Button>
      </div>
      <div className="flex items-end justify-between gap-2">
        <label className="grid gap-1 text-sm">
          Go to date
          <input
            type="date"
            className="min-h-12 rounded border bg-background p-2"
            value={state.date}
            onChange={(event) => {
              if (event.target.value) go({ ...state, date: event.target.value });
            }}
          />
        </label>
        {state.date !== today ? (
          <Button className="min-h-12" onClick={() => go({ ...state, date: today })}>
            Today
          </Button>
        ) : null}
      </div>
      {read.status === "loading" ? (
        <p role="status">Loading the team roster…</p>
      ) : read.status !== "ready" ? (
        <div role="alert">
          <p>{read.message}</p>
          <Button onClick={read.reload}>Try again</Button>
        </div>
      ) : state.view === "day" ? (
        <DayView actorId={actorId} now={now} day={state.date} today={today} rows={rows} onSelect={setSelected} />
      ) : (
        <ShiftsByDay rows={rows} actorId={actorId} onSelect={setSelected} />
      )}
      <ModeGroupedList>
        <ModeRow
          title="Phone numbers are in On call"
          href={`/on-call/service?service=${encodeURIComponent(team.serviceId)}`}
        />
      </ModeGroupedList>
      <RosterSentBar receipt={sent} clear={clearSent} />
      {selected ? (
        <ShiftSheet
          shift={selected}
          team={team}
          actorId={actorId}
          now={now}
          onClose={() => setSelected(null)}
          onSwap={(shift) => {
            setSelected(null);
            setRequest({ kind: "swap", shift });
          }}
          onGiveAway={(shift) => {
            setSelected(null);
            setRequest({ kind: "give_away", shift });
          }}
        />
      ) : null}
      {actorId && request ? (
        <SwapFlowSheet
          open
          onClose={() => setRequest(null)}
          serviceId={team.serviceId}
          actorId={actorId}
          give={request.shift}
          mode={request.kind}
          onSent={onSent}
        />
      ) : null}
    </>
  );
}
