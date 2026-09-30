"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { RosterSentBar, type SentReceipt } from "@/components/roster/requests/roster-sent-bar";
import { SwapFlowSheet } from "@/components/roster/swaps/swap-flow-sheet";
import { postRosterAction, useRosterRead } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { monthKeyOf } from "@/lib/calendar/month-grid";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import {
  calendarStateQuery,
  calendarWindow,
  filterAssignments,
  monthCells,
  readCalendarState,
  stepCalendar,
  weekBoard,
  type BoardRow,
  type CalendarShow,
  type CalendarState,
  type CalendarView,
} from "@/lib/roster/team/calendar-model";
import type { RosterAssignment, RosterSwap, RosterTeam } from "@/lib/roster/team/model";
import { assignmentStartDate } from "@/lib/roster/team/team-view";

import { CalendarFilters, type CalendarPerson } from "./calendar-filters";
import { DaySheet } from "./day-sheet";
import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { NeedsYouStrip } from "./needs-you-strip";
import { PrintButton } from "./print-button";
import { ShiftSheet } from "./shift-sheet";
import { useManagerCalendar } from "./use-manager-calendar";
import { WeekBoard } from "./week-board";

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

/** Assignment ids in the reader's own swaps that are still waiting on an answer. */
function pendingAssignmentIds(swaps: readonly RosterSwap[], actorId: string | null, now: Date): Set<string> {
  const ids = new Set<string>();
  if (!actorId) return ids;
  for (const swap of swaps) {
    if (swap.status !== "requested" && swap.status !== "accepted") continue;
    // A request nobody answered in time is expired, not waiting.
    if (swap.status === "requested" && Date.parse(swap.expiresAt) < now.getTime()) continue;
    if (swap.requesterId !== actorId && swap.counterpartyId !== actorId) continue;
    for (const side of [swap.give, swap.take]) if (side) ids.add(side.id);
  }
  return ids;
}

/** In Compare, both people get a row even when one has no shifts that week. */
function withComparedPeople(
  board: BoardRow[],
  show: CalendarShow,
  actorId: string | null,
  people: readonly CalendarPerson[],
): BoardRow[] {
  if (show.kind !== "compare") return board;
  const missing = (userId: string | null, isMe: boolean): BoardRow[] =>
    userId === null || board.some((row) => row.userId === userId)
      ? []
      : [
          {
            userId,
            name: people.find((person) => person.userId === userId)?.name ?? "Name not available",
            grade: null,
            isMe,
            days: Array.from({ length: 7 }, () => []),
          },
        ];
  // Comparing with myself is one row, not two.
  const merged = [...board, ...missing(actorId, true), ...(show.userId === actorId ? [] : missing(show.userId, false))];
  return merged.sort((a, b) => Number(b.isMe) - Number(a.isMe));
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
  const requests = useRosterRead(team.serviceId, "requests");
  const read = useRosterRead(team.serviceId, "assignments", calendarWindow(state));
  const reload = read.reload;
  const [selected, setSelected] = useState<RosterAssignment | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
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
  const rows = filterAssignments(all, state.show, actorId, now);
  const unit = UNIT[state.view];
  const monday = calendarWindow({ ...state, view: "week" }).from;
  const weekDays = Array.from({ length: 7 }, (_, index) => addDaysToDate(monday, index));
  const pendingSwapIds = pendingAssignmentIds(requests.data?.swaps ?? [], actorId, now);
  // Cover counts and rule flags read every shift in the window, not the filtered ones.
  const manager = useManagerCalendar(team, calendarWindow(state), all, actorId);
  const managerReload = manager.reload;
  const requestsReload = requests.reload;
  const managerChanged = useCallback(() => {
    managerReload();
    requestsReload();
    reload();
  }, [managerReload, requestsReload, reload]);
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
        {state.view === "month" ? <PrintButton /> : null}
      </div>
      {manager.enabled ? (
        <NeedsYouStrip
          serviceId={team.serviceId}
          pending={manager.pending}
          claimed={manager.claimed}
          shortDays={manager.shortDays.filter((date) => date >= today)}
          checks={manager}
          onChanged={managerChanged}
          onPickDay={(date) => go({ ...state, view: "day", date })}
        />
      ) : manager.unavailable ? (
        <p className="text-sm text-[color:var(--text-muted)]">Manager tools aren&apos;t available right now.</p>
      ) : null}
      {read.status === "loading" ? (
        <p role="status">Loading the team roster…</p>
      ) : read.status !== "ready" ? (
        <div role="alert">
          <p>{read.message}</p>
          <Button onClick={read.reload}>Try again</Button>
        </div>
      ) : state.view === "day" ? (
        <DayView actorId={actorId} now={now} day={state.date} today={today} rows={rows} onSelect={setSelected} />
      ) : state.view === "week" ? (
        <WeekBoard
          rows={withComparedPeople(weekBoard(monday, rows, actorId), state.show, actorId, peopleIn(all))}
          days={weekDays}
          onPickShift={setSelected}
          pendingSwapIds={pendingSwapIds}
          openShifts={requests.data?.openShifts}
          cover={manager.cover}
          flags={manager.flags}
        />
      ) : (
        <MonthView
          cells={monthCells(monthKeyOf(state.date), rows, actorId)}
          today={today}
          onPickDay={setPickedDay}
          cover={manager.cover}
        />
      )}
      <ModeGroupedList>
        <ModeRow
          title="Phone numbers are in On call"
          href={`/on-call/service?service=${encodeURIComponent(team.serviceId)}`}
        />
      </ModeGroupedList>
      <RosterSentBar receipt={sent} clear={clearSent} />
      {pickedDay ? (
        <DaySheet
          date={pickedDay}
          rows={rows.filter((row) => assignmentStartDate(row) === pickedDay)}
          actorId={actorId}
          now={now}
          filtered={state.show.kind !== "everyone"}
          onClose={() => setPickedDay(null)}
          onPickShift={(shift) => {
            setPickedDay(null);
            setSelected(shift);
          }}
          onSwap={(shift) => {
            setPickedDay(null);
            setRequest({ kind: "swap", shift });
          }}
          onGiveAway={(shift) => {
            setPickedDay(null);
            setRequest({ kind: "give_away", shift });
          }}
        />
      ) : null}
      {selected ? (
        <ShiftSheet
          shift={selected}
          team={team}
          actorId={actorId}
          now={now}
          flags={manager.enabled ? manager.flags.get(selected.id) : undefined}
          manage={manager.enabled ? { onChanged: managerChanged, pending: manager.pending, checks: manager } : null}
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
