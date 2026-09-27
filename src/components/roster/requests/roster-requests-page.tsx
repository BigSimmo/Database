"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { modeIconTile, modeModuleSurface } from "@/components/mode-kit/recipes";
import { RosterAskBox } from "@/components/roster/ask/roster-ask-box";
import { RosterDutyAgreements } from "@/components/roster/maker/roster-duty-agreements";
import { kindOf, useRosterNow } from "@/components/roster/roster-format";
import { useRosterShifts } from "@/components/roster/use-roster-shifts";
import { useRosterRead, useRosterTeams, postRosterAction } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { formatDateSpan } from "@/components/roster/roster-format";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { SHIFT_KIND_LABEL, SHIFT_LETTER } from "@/lib/roster/shift-kind";
import { gradeRank, placementProblem } from "@/lib/roster/team/eligibility";
import type { RosterAction, RosterOpenShift, RosterSwap } from "@/lib/roster/team/model";
import { requestStatusWords } from "@/lib/roster/team/request-status";
import type { RosterLeave } from "@/lib/roster/leave";

import { RosterDatesSheet } from "./roster-dates-sheet";
import { RosterGiveAwaySheet } from "./roster-give-away-sheet";
import { RosterLeaveSheet } from "./roster-leave-sheet";
import { RosterSentBar, type SentReceipt } from "./roster-sent-bar";
import { RosterSwapSheet } from "./roster-swap-sheet";

type Start = "swap" | "give_away" | "cant_make" | "dates" | "leave";
type ActiveSheet = {
  kind: Start;
  assignment?: string;
  withId?: string;
  swapId?: string;
  leaveId?: string;
  date?: string;
  to?: string;
  dateKind?: "cant" | "prefer_off";
} | null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const subscribeSearch = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const searchSnapshot = () => window.location.search;
const serverSearchSnapshot = () => "";
const activeSwap = (item: RosterSwap) => item.status === "requested" || item.status === "accepted";
const activeOpen = (item: RosterOpenShift) =>
  item.status === "reported" || item.status === "open" || item.status === "claimed";

function leaveStatus(status: RosterLeave["status"]): string {
  return { planned: "Planned · also lodge in HR", applied: "Applied in HR", approved: "Approved in HR" }[status];
}

function requestRow(letter: string, title: string, detail: string, status: string, action: ReactNode, key: string) {
  return (
    <li
      key={key}
      className="flex min-w-0 items-center gap-3 border-b border-[color:var(--border)] px-3 py-3 last:border-0"
    >
      <span aria-hidden="true" className={cn(modeIconTile, "shrink-0")}>
        {letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="text-sm text-[color:var(--text-muted)]">{detail}</p>
        <p
          className={
            status === "Needs you"
              ? "text-sm font-medium text-[color:var(--info)]"
              : "text-sm text-[color:var(--text-muted)]"
          }
        >
          {status}
        </p>
      </div>
      {action}
    </li>
  );
}

/** Team requests and my own leave; all answers are session-only React state. */
export function RosterRequestsPage() {
  const now = useRosterNow();
  const search = useSyncExternalStore(subscribeSearch, searchSnapshot, serverSearchSnapshot);
  const [consumedSearch, setConsumedSearch] = useState<string | null>(null);
  const teams = useRosterTeams();
  const ownShifts = useRosterShifts();
  const enabled = useMemo(() => teams.data?.teams.filter((team) => team.enabled) ?? [], [teams.data]);
  const actorId = teams.data?.actorId ?? null;
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const serviceId =
    enabled.length > 1
      ? (enabled.find((team) => team.serviceId === selectedServiceId)?.serviceId ?? null)
      : (enabled[0]?.serviceId ?? null);
  const today = perthDateOf(now);
  const range = useMemo(() => ({ from: addDaysToDate(today, -7), to: addDaysToDate(today, 54) }), [today]);
  const overview = useRosterRead(serviceId, "overview");
  const assignments = useRosterRead(serviceId, "assignments", range);
  const requests = useRosterRead(serviceId, "requests");
  const [leave, setLeave] = useState<RosterLeave[]>([]);
  const [leaveState, setLeaveState] = useState<"loading" | "ready" | "error">("loading");
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [sent, setSent] = useState<SentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenOpenIds, setHiddenOpenIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const clearSent = useCallback(() => setSent(null), []);
  const leaveReadSequence = useRef(0);

  const reload = useCallback(() => {
    overview.reload();
    assignments.reload();
    requests.reload();
  }, [overview, assignments, requests]);
  const loadLeave = useCallback((signal?: AbortSignal) => {
    const sequence = ++leaveReadSequence.current;
    return Promise.resolve()
      .then(() => fetch("/api/roster/leave", { cache: "no-store", signal }))
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ leave: RosterLeave[] }>;
      })
      .then((payload) => {
        if (signal?.aborted || sequence !== leaveReadSequence.current) return;
        setLeave(payload.leave);
        setLeaveState("ready");
      })
      .catch(() => {
        if (signal?.aborted || sequence !== leaveReadSequence.current) return;
        setLeaveState("error");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (teams.status === "ready") void loadLeave(controller.signal);
    return () => controller.abort();
  }, [teams.status, loadLeave]);
  const handoff = (() => {
    if (teams.status !== "ready" || !search || search === consumedSearch) return null;
    const params = new URLSearchParams(search);
    const start = params.get("start");
    if (!start || !["swap", "give_away", "cant_make", "dates", "leave"].includes(start)) return null;
    const assignment = params.get("assignment");
    const withId = params.get("with");
    const teamId = params.get("team");
    const date = params.get("date");
    const to = params.get("to");
    const dateKind = params.get("kind");
    // Query parameters may prefill a sheet; they can never identify the actor.
    if (
      (assignment && !UUID.test(assignment)) ||
      (withId && !UUID.test(withId)) ||
      (date && !DATE.test(date)) ||
      (to && !DATE.test(to))
    )
      return null;
    if (start === "dates" && dateKind && dateKind !== "cant" && dateKind !== "prefer_off") return null;
    let targetServiceId = serviceId;
    if (start !== "leave" && enabled.length > 1) {
      if (teamId && (!UUID.test(teamId) || !enabled.some((team) => team.serviceId === teamId))) return null;
      targetServiceId = teamId ?? serviceId;
    }
    if (start !== "leave" && (!targetServiceId || !actorId)) return null;
    return {
      serviceId: targetServiceId,
      sheet: {
        kind: start as Start,
        assignment: assignment ?? undefined,
        withId: withId ?? undefined,
        date: date ?? undefined,
        to: to ?? undefined,
        dateKind: dateKind === "prefer_off" ? "prefer_off" : undefined,
      } satisfies NonNullable<ActiveSheet>,
    };
  })();
  if (handoff) {
    setConsumedSearch(search);
    setSelectedServiceId(handoff.serviceId);
    setSheet(handoff.sheet);
  }
  useEffect(() => {
    if (consumedSearch && window.location.search === consumedSearch)
      window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [consumedSearch]);

  const onSent = useCallback(
    (message: string, undo?: () => Promise<void>) => {
      setSent({
        message,
        undo: undo
          ? async () => {
              await undo();
              reload();
              void loadLeave();
            }
          : undefined,
      });
      reload();
      void loadLeave();
    },
    [reload, loadLeave],
  );

  async function openAction(item: RosterOpenShift, action: "open.claim" | "open.cancel") {
    if (!serviceId || !actorId) return;
    const rank = gradeRank(overview.data?.me.grade);
    const minimum = gradeRank(item.minGrade);
    if (action === "open.claim" && (rank === null || (minimum !== null && rank < minimum))) return;
    setBusyId(item.id);
    setError(null);
    const result = await postRosterAction(serviceId, { action, openShiftId: item.id } as RosterAction);
    setBusyId(null);
    if (!result.ok) {
      setError(result.code === "roster_open_shift_taken" ? "Someone else took this shift first." : result.message);
      if (result.code === "roster_open_shift_taken") setHiddenOpenIds((old) => [...old, item.id]);
      return;
    }
    onSent(action === "open.claim" ? "Asked to take the shift" : "Offer withdrawn");
  }

  async function swapAction(item: RosterSwap, action: "swap.cancel" | "swap.undo") {
    if (!serviceId || !actorId) return;
    setBusyId(item.id);
    setError(null);
    const result = await postRosterAction(serviceId, { action, swapId: item.id } as RosterAction);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent(action === "swap.undo" ? "Swap undone" : "Swap withdrawn");
  }

  const swaps = requests.data?.swaps ?? [];
  const openShifts = requests.data?.openShifts ?? [];
  const myAssignments = assignments.data?.assignments ?? [];
  const ownPlacementRows =
    actorId && ownShifts.status === "ready"
      ? ownShifts.shifts
          .filter((item) => item.source !== "team")
          .map((item) => ({
            id: item.id,
            userId: actorId,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            kind: kindOf(item),
          }))
      : [];
  const actorGradeRank = gradeRank(overview.data?.me.grade);
  const eligibleOpen =
    actorId && ownShifts.status === "ready" && overview.status === "ready" && actorGradeRank !== null
      ? openShifts.filter((item) => {
          const minimum = gradeRank(item.minGrade);
          return (
            !item.mine &&
            item.status === "open" &&
            !item.claimedByMe &&
            !hiddenOpenIds.includes(item.id) &&
            (minimum === null || actorGradeRank >= minimum) &&
            !placementProblem(
              [...myAssignments, ...ownPlacementRows],
              actorId,
              item.startsAt,
              item.endsAt,
              [],
              overview.data?.settings.rules.minBreakHours ?? null,
            )
          );
        })
      : [];
  const myOpen = openShifts.filter((item) => item.mine || item.claimedByMe);
  const teamOpen = [...swaps.filter(activeSwap), ...myOpen.filter(activeOpen)];
  const earlier = [...swaps.filter((item) => !activeSwap(item)), ...myOpen.filter((item) => !activeOpen(item))];
  const currentLeave = leave.filter((item) => item.endsOn >= today);
  const earlierLeave = leave.filter((item) => item.endsOn < today);

  function swapRow(item: RosterSwap) {
    const mine = item.requesterId === actorId;
    const title = mine
      ? `Your ${item.give ? `${formatPerthDay(perthDateOf(item.give.startsAt))} ${item.give.kind}` : "swap"}`
      : `${item.requesterName ?? "A colleague"} asks to swap`;
    const status = requestStatusWords(item, actorId!);
    const undo =
      item.status === "approved" &&
      item.autoApproved &&
      item.decidedAt &&
      now.getTime() < Date.parse(item.decidedAt) + 600_000;
    return requestRow(
      "S",
      title,
      item.take ? `For ${formatPerthDay(perthDateOf(item.take.startsAt))}` : "No shift in return",
      status,
      <div className="grid gap-1">
        <Button size="sm" onClick={() => setSheet({ kind: "swap", swapId: item.id })}>
          Review
        </Button>
        {mine && item.status === "requested" ? (
          <Button size="sm" disabled={busyId === item.id} onClick={() => void swapAction(item, "swap.cancel")}>
            Withdraw
          </Button>
        ) : null}
        {undo ? (
          <Button size="sm" disabled={busyId === item.id} onClick={() => void swapAction(item, "swap.undo")}>
            Undo
          </Button>
        ) : null}
      </div>,
      item.id,
    );
  }

  function openRow(item: RosterOpenShift) {
    const status = requestStatusWords(item, actorId!);
    return requestRow(
      SHIFT_LETTER[item.kind],
      item.mine
        ? `Your ${formatPerthDay(perthDateOf(item.startsAt))} ${SHIFT_KIND_LABEL[item.kind].toLowerCase()}`
        : "Open shift you took",
      formatPerthDay(perthDateOf(item.startsAt)),
      status,
      item.mine && (item.status === "open" || item.status === "reported") ? (
        <Button size="sm" disabled={busyId === item.id} onClick={() => void openAction(item, "open.cancel")}>
          Withdraw
        </Button>
      ) : null,
      item.id,
    );
  }

  function leaveRow(item: RosterLeave) {
    return requestRow(
      "L",
      `Leave ${formatDateSpan(item.startsOn, item.endsOn)}`,
      item.kind === "annual" ? "Annual leave" : "Professional development leave",
      leaveStatus(item.status),
      <Button size="sm" onClick={() => setSheet({ kind: "leave", leaveId: item.id })}>
        Review
      </Button>,
      item.id,
    );
  }

  const canTeamAct = !!serviceId && !!actorId && overview.status === "ready";
  return (
    <InformationPageShell testId="roster-requests-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[color:var(--text-muted)]">Roster</p>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="text-sm text-[color:var(--text-muted)]">Swaps, open shifts, dates and leave.</p>
        </div>
        <Button icon={Plus} variant="primary" disabled={teams.status !== "ready"} onClick={() => setNewOpen(true)}>
          New
        </Button>
      </header>
      <RosterAskBox />
      {enabled.length > 1 ? (
        <label className="grid max-w-sm gap-1 text-sm">
          Team
          <select
            value={selectedServiceId ?? ""}
            onChange={(event) => setSelectedServiceId(event.target.value || null)}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          >
            <option value="">Choose a team</option>
            {enabled.map((team) => (
              <option value={team.serviceId} key={team.serviceId}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {enabled.length > 1 && !selectedServiceId ? <p>Choose the team for a request before continuing.</p> : null}
      {teams.status === "loading" ? <p role="status">Loading your teams…</p> : null}
      {teams.status === "signed-out" ? <p>Sign in to see your requests and leave.</p> : null}
      {teams.status === "error" ? <p role="alert">{teams.message}</p> : null}
      {teams.status === "ready" && !enabled.length ? (
        <p>No confirmed team yet. You can still plan your own leave.</p>
      ) : null}
      {serviceId && (requests.status === "error" || assignments.status === "error" || overview.status === "error") ? (
        <p role="alert">
          The team roster couldn&apos;t be checked. <Button onClick={reload}>Try again</Button>
        </p>
      ) : null}
      {serviceId && ownShifts.status === "error" ? (
        <p role="alert">Your own shifts couldn&apos;t be checked. Open shifts are hidden until they can be checked.</p>
      ) : null}
      {serviceId &&
      overview.status === "ready" &&
      actorGradeRank === null &&
      openShifts.some((item) => !item.mine && item.status === "open") ? (
        <p role="status">Add your grade in Your team before taking an open shift.</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <RosterSentBar receipt={sent} clear={clearSent} />
      {canTeamAct && serviceId ? (
        <RosterDutyAgreements
          key={serviceId}
          serviceId={serviceId}
          sites={Object.fromEntries((overview.data?.sites ?? []).map((site) => [site.id, site.name]))}
        />
      ) : null}
      {eligibleOpen.length ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Open shifts I can take</h2>
          <ul className={modeModuleSurface}>
            {eligibleOpen.map((item) =>
              requestRow(
                SHIFT_LETTER[item.kind],
                `${formatPerthDay(perthDateOf(item.startsAt))} ${SHIFT_KIND_LABEL[item.kind]}`,
                "The team needs someone",
                "Open to take",
                <Button size="sm" disabled={busyId === item.id} onClick={() => void openAction(item, "open.claim")}>
                  Take it
                </Button>,
                item.id,
              ),
            )}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-medium">Open {teamOpen.length + currentLeave.length}</h2>
        {teamOpen.length || currentLeave.length ? (
          <ul className={modeModuleSurface}>
            {swaps.filter(activeSwap).map(swapRow)}
            {myOpen.filter(activeOpen).map(openRow)}
            {currentLeave.map(leaveRow)}
          </ul>
        ) : (
          <p className="rounded-xl border border-[color:var(--border)] p-4">
            Nothing yet. To swap, tap one of your shifts.
          </p>
        )}
      </section>
      {earlier.length || earlierLeave.length ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Earlier</h2>
          <ul className={modeModuleSurface}>
            {swaps.filter((item) => !activeSwap(item)).map(swapRow)}
            {myOpen.filter((item) => !activeOpen(item)).map(openRow)}
            {earlierLeave.map(leaveRow)}
          </ul>
        </section>
      ) : null}
      {leaveState === "error" ? (
        <p role="alert">
          Your leave couldn&apos;t be loaded. <Button onClick={() => void loadLeave()}>Try again</Button>
        </p>
      ) : null}
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New request">
        <div className="grid gap-2">
          {(
            [
              ["swap", "Swap a shift"],
              ["give_away", "Give a shift away"],
              ["cant_make", "I can't make my shift"],
              ["dates", "Dates I can't work"],
              ["leave", "Plan leave"],
            ] as const
          ).map(([kind, label]) => (
            <Button
              key={kind}
              disabled={kind !== "leave" && !canTeamAct}
              onClick={() => {
                setNewOpen(false);
                setSheet({ kind });
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </Sheet>
      {serviceId && actorId ? (
        <>
          <RosterSwapSheet
            open={sheet?.kind === "swap"}
            onClose={() => setSheet(null)}
            serviceId={serviceId}
            actorId={actorId}
            initialGiveId={sheet?.kind === "swap" ? sheet.assignment : undefined}
            initialWithId={sheet?.kind === "swap" ? sheet.withId : undefined}
            swapId={sheet?.kind === "swap" ? sheet.swapId : undefined}
            onSent={onSent}
          />
          <RosterGiveAwaySheet
            open={sheet?.kind === "give_away" || sheet?.kind === "cant_make"}
            onClose={() => setSheet(null)}
            serviceId={serviceId}
            actorId={actorId}
            initialAssignmentId={sheet?.assignment}
            urgent={sheet?.kind === "cant_make"}
            onSent={onSent}
          />
          <RosterDatesSheet
            open={sheet?.kind === "dates"}
            onClose={() => setSheet(null)}
            serviceId={serviceId}
            actorId={actorId}
            initialDate={sheet?.kind === "dates" ? sheet.date : undefined}
            toDate={sheet?.kind === "dates" ? sheet.to : undefined}
            initialKind={sheet?.kind === "dates" ? sheet.dateKind : undefined}
            onSent={onSent}
          />
        </>
      ) : null}
      <RosterLeaveSheet
        open={sheet?.kind === "leave"}
        onClose={() => setSheet(null)}
        teams={enabled}
        actorId={actorId ?? ""}
        assignments={myAssignments}
        initialDate={sheet?.kind === "leave" ? sheet.date : undefined}
        initialTo={sheet?.kind === "leave" ? sheet.to : undefined}
        existing={leave.find((item) => item.id === sheet?.leaveId)}
        onSent={onSent}
        onSaved={(entry) => setLeave((old) => [...old.filter((item) => item.id !== entry.id), entry])}
        onDeleted={(id) => setLeave((old) => old.filter((item) => item.id !== id))}
      />
    </InformationPageShell>
  );
}
