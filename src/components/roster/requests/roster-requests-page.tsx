"use client";

import { Inbox, Plane, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { modeIconTile, modeModuleSurface } from "@/components/mode-kit/recipes";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { SwapFlowSheet } from "@/components/roster/swaps/swap-flow-sheet";
import { RosterSampleNotice } from "@/components/roster/team/roster-sample-notice";
import { useRosterNow } from "@/components/roster/roster-format";
import { useRosterRead, useRosterTeams } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formatDateSpan } from "@/components/roster/roster-format";
import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import type { RosterLeave } from "@/lib/roster/leave";

import { RosterDatesSheet } from "./roster-dates-sheet";
import { RosterGiveAwaySheet } from "./roster-give-away-sheet";
import { RosterLeaveSheet } from "./roster-leave-sheet";
import { RosterSentBar, type SentReceipt } from "./roster-sent-bar";
import { RosterSignInNotice } from "@/components/roster/invite/roster-sign-in-notice";
import { RosterEmpty, RosterPageHeader, rosterField } from "@/components/roster/roster-ui";

type Start = "swap" | "give_away" | "cant_make" | "dates" | "leave";
type ActiveSheet = {
  kind: Start;
  assignment?: string;
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

/** Dates I can't work, leave and shifts I can't make. Swaps and open shifts live on the Swaps page. */
export function RosterRequestsPage() {
  const now = useRosterNow();
  const search = useSyncExternalStore(subscribeSearch, searchSnapshot, serverSearchSnapshot);
  const [consumedSearch, setConsumedSearch] = useState<string | null>(null);
  const teams = useRosterTeams();
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
  const [leave, setLeave] = useState<RosterLeave[]>([]);
  const [leaveState, setLeaveState] = useState<"loading" | "ready" | "error">("loading");
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [sent, setSent] = useState<SentReceipt | null>(null);
  const clearSent = useCallback(() => setSent(null), []);
  const leaveReadSequence = useRef(0);

  const reload = useCallback(() => {
    overview.reload();
    assignments.reload();
  }, [overview, assignments]);
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
    const teamId = params.get("team");
    const date = params.get("date");
    const to = params.get("to");
    const dateKind = params.get("kind");
    // Query parameters may prefill a sheet; they can never identify the actor.
    if ((assignment && !UUID.test(assignment)) || (date && !DATE.test(date)) || (to && !DATE.test(to))) return null;
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

  const myAssignments = assignments.data?.assignments ?? [];
  const swapGive =
    sheet?.kind === "swap" && actorId
      ? myAssignments.find((item) => item.id === sheet.assignment && item.userId === actorId)
      : undefined;
  const currentLeave = leave.filter((item) => item.endsOn >= today);
  const earlierLeave = leave.filter((item) => item.endsOn < today);

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
      <RosterPageHeader
        icon={Inbox}
        eyebrow="Roster"
        title="Requests"
        subtitle="Dates you can't work, leave, and shifts you can't make."
        actions={
          <Button icon={Plus} variant="primary" disabled={teams.status !== "ready"} onClick={() => setNewOpen(true)}>
            New
          </Button>
        }
      />
      <RosterSampleNotice sample={teams.data?.sample} />
      {enabled.length > 1 ? (
        <label className="grid max-w-sm gap-1 text-sm">
          Team
          <select
            value={selectedServiceId ?? ""}
            onChange={(event) => setSelectedServiceId(event.target.value || null)}
            className={rosterField}
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
      {teams.status === "signed-out" ? (
        <RosterSignInNotice testId="roster-requests-signed-out">Sign in to see your leave and requests.</RosterSignInNotice>
      ) : null}
      {teams.status === "not-confirmed" || teams.status === "unavailable" ? (
        <ModeNotice testId="roster-requests-team-pending">
          {teams.status === "not-confirmed" && teams.message
            ? teams.message
            : "Team requests aren\u2019t available yet. Try again later."}
        </ModeNotice>
      ) : null}
      {teams.status === "error" ? (
        <div role="alert" className="grid gap-2">
          <p>{teams.message}</p>
          <Button className="justify-self-start" onClick={teams.reload}>
            Try again
          </Button>
        </div>
      ) : null}
      {teams.status === "ready" && !enabled.length ? (
        <p>No confirmed team yet. You can still plan your own leave.</p>
      ) : null}
      {serviceId && (assignments.status === "error" || overview.status === "error") ? (
        <div role="alert" className="grid gap-2">
          <p>The team roster couldn&apos;t be checked.</p>
          <Button className="justify-self-start" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : null}
      <RosterSentBar receipt={sent} clear={clearSent} />
      <ModeGroupedList>
        <ModeRow
          title="Swaps and open shifts"
          subtitle="Answer a swap, follow one you sent, or take an open shift."
          href="/roster/swaps"
        />
      </ModeGroupedList>
      <section>
        <h2 className={cn(eyebrowText, "mb-2 flex items-center gap-2 px-1")}>
          Leave
          <span className="nums rounded-full bg-[color:var(--surface-wash)] px-2 text-xs text-[color:var(--text-muted)]">
            {currentLeave.length}
          </span>
        </h2>
        {currentLeave.length ? (
          <ul className={modeModuleSurface}>{currentLeave.map(leaveRow)}</ul>
        ) : teams.status === "loading" || (teams.status === "ready" && leaveState === "loading") ? (
          <>
            <p role="status" className="sr-only">
              Loading your leave…
            </p>
            <ModeModuleSkeleton rows={2} twoLine testId="roster-requests-leave-loading" />
          </>
        ) : teams.status === "ready" && leaveState === "ready" ? (
          <RosterEmpty icon={Plane}>Nothing yet. Tap New to plan leave or mark dates you can&apos;t work.</RosterEmpty>
        ) : null}
      </section>
      {earlierLeave.length ? (
        <section>
          <h2 className={cn(eyebrowText, "mb-2 px-1")}>Earlier</h2>
          <ul className={modeModuleSurface}>{earlierLeave.map(leaveRow)}</ul>
        </section>
      ) : null}
      {sheet?.kind === "swap" && assignments.status === "ready" && !swapGive ? (
        <p role="alert">
          That shift couldn&apos;t be found. Open it from the <Link href="/roster/team">Team calendar</Link> to swap it.
        </p>
      ) : null}
      {leaveState === "error" ? (
        <div role="alert" className="grid gap-2">
          <p>Your leave couldn&apos;t be loaded.</p>
          <Button className="justify-self-start" onClick={() => void loadLeave()}>
            Try again
          </Button>
        </div>
      ) : null}
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New request">
        <div className="grid gap-2">
          {(
            [
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
          {swapGive ? (
            <SwapFlowSheet
              open
              onClose={() => setSheet(null)}
              serviceId={serviceId}
              actorId={actorId}
              give={swapGive}
              mode="swap"
              onSent={onSent}
            />
          ) : null}
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
