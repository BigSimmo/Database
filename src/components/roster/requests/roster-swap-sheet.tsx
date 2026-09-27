"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import { useRosterNow } from "@/components/roster/roster-format";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { fetchRosterRead, postRosterAction } from "@/components/roster/use-roster-team";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { hoursSinceLastShift, placementProblem, swapCandidates, swapNeedsManager } from "@/lib/roster/team/eligibility";
import type {
  RosterAction,
  RosterAssignment,
  RosterOverview,
  RosterRequests,
  RosterSwap,
} from "@/lib/roster/team/model";

import { RosterSwapTicket } from "./roster-swap-ticket";
import type { RequestSent } from "./request-ui";

type Fresh = { assignments: RosterAssignment[]; requests: RosterRequests; overview: RosterOverview; readAt: Date };

const reasonWords = {
  team_setting: "the team asks your manager to approve swaps",
  within_7_days: "it's within 7 days",
  different_grade: "the grades differ",
  team_rule: "a team rule needs a check",
} as const;

function checkedTime(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function RosterSwapSheet(props: ComponentProps<typeof SwapSession>) {
  return props.open ? (
    <SwapSession
      key={JSON.stringify([props.serviceId, props.actorId, props.initialGiveId, props.initialWithId, props.swapId])}
      {...props}
    />
  ) : null;
}

function SwapSession({
  open,
  onClose,
  serviceId,
  actorId,
  initialGiveId,
  initialWithId,
  swapId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  actorId: string;
  initialGiveId?: string | null;
  initialWithId?: string | null;
  swapId?: string | null;
  onSent: RequestSent;
}) {
  const now = useRosterNow();
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [giveId, setGiveId] = useState(initialGiveId ?? "");
  const [colleagueId, setColleagueId] = useState(initialWithId ?? "");
  const [takeId, setTakeId] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void Promise.all([
      fetchRosterRead(serviceId, "assignments", {
        from: perthDateOf(new Date()),
        to: new Date(Date.now() + 54 * 86_400_000).toISOString().slice(0, 10),
      }),
      fetchRosterRead(serviceId, "requests"),
      fetchRosterRead(serviceId, "overview"),
    ]).then(([assignments, requests, overview]) => {
      if (!current) return;
      if (!assignments.ok || !requests.ok || !overview.ok) {
        setError("The team roster changed or couldn't be checked. Close and try again.");
        return;
      }
      setFresh({
        assignments: assignments.data.assignments,
        requests: requests.data,
        overview: overview.data,
        readAt: assignments.readAt,
      });
    });
    return () => {
      current = false;
    };
  }, [open, serviceId, initialGiveId, initialWithId]);

  const swap: RosterSwap | undefined = fresh?.requests.swaps.find((item) => item.id === swapId);
  const myShifts = useMemo(
    () => fresh?.assignments.filter((shift) => shift.userId === actorId && shift.kind !== "leave") ?? [],
    [fresh, actorId],
  );
  const give = swap?.give ?? myShifts.find((shift) => shift.id === giveId);
  const candidates =
    fresh && give
      ? swapCandidates(
          fresh.assignments,
          give,
          { userId: actorId, grade: fresh.overview.me.grade },
          fresh.overview.settings,
        )
      : [];
  const chosen = candidates.find((candidate) => candidate.userId === colleagueId);
  const colleagueShifts =
    fresh?.assignments.filter(
      (shift) => shift.userId === colleagueId && Date.parse(shift.startsAt) > now.getTime() && shift.id !== give?.id,
    ) ?? [];
  const take = swap?.take ?? colleagueShifts.find((shift) => shift.id === takeId) ?? null;
  const counterparty = swap?.counterpartyId ?? colleagueId;
  const managerReason =
    fresh && give && counterparty
      ? swapNeedsManager({
          give,
          take,
          giverGrade: give.grade ?? fresh.overview.me.grade,
          takerGrade: chosen?.grade ?? take?.grade ?? fresh.overview.me.grade,
          counterpartyId: counterparty,
          settings: fresh.overview.settings,
          assignments: fresh.assignments,
          now,
        })
      : null;
  const clash =
    fresh && give && counterparty
      ? placementProblem(fresh.assignments, counterparty, give.startsAt, give.endsAt, [take?.id], null)
      : null;

  async function act(action: "swap.create" | "swap.accept" | "swap.decline" | "swap.undo") {
    if (!give || !fresh || !actorId) return;
    setBusy(true);
    setError(null);
    const payload =
      action === "swap.create"
        ? ({
            action,
            giveAssignmentId: give.id,
            counterpartyId: colleagueId,
            takeAssignmentId: take?.id ?? null,
          } as const)
        : ({ action, swapId: (action === "swap.undo" ? (undoId ?? swapId) : swapId)! } as const);
    const result = await postRosterAction(serviceId, payload as RosterAction);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (action === "swap.accept" && result.result.status === "cancelled") {
      setError(
        result.result.cancelReason === "no_longer_fits"
          ? "This swap no longer fits the current roster. Refresh Requests before trying again."
          : "This swap was cancelled because the roster changed. Refresh Requests before trying again.",
      );
      return;
    }
    if (action === "swap.undo") {
      onSent("Swap undone");
      onClose();
      return;
    }
    if (action === "swap.accept" && result.result.autoApproved && swapId) {
      setUndoId(swapId);
      onSent("Swap approved itself");
      return;
    }
    if (action === "swap.create" && result.result.swapId) {
      const id = result.result.swapId;
      onSent("Swap sent", async () => {
        const reverse = await postRosterAction(serviceId, { action: "swap.cancel", swapId: id });
        if (!reverse.ok) throw new Error(reverse.message);
      });
    } else onSent(action === "swap.accept" ? "Swap accepted" : "Swap declined");
    onClose();
  }

  const askSide = swap && swap.counterpartyId === actorId && swap.status === "requested";
  const reviewingCounterparty = swap?.counterpartyId === actorId;
  const canCreate = !swap && give && chosen && !clash;
  const canUndo =
    swap?.status === "approved" &&
    swap.autoApproved &&
    swap.decidedAt &&
    now.getTime() < Date.parse(swap.decidedAt) + 600_000;

  return (
    <Sheet open={open} onClose={onClose} title={swap ? "Review swap" : "Swap a shift"}>
      <div className="grid gap-4">
        {!fresh && !error ? <p role="status">Checking the team roster…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {fresh && swapId && !swap ? <p role="alert">That swap changed. Close and refresh Requests.</p> : null}
        {fresh && !swapId ? (
          <label className="grid gap-1 text-sm">
            My shift
            <select
              value={give?.id ?? ""}
              onChange={(event) => {
                setGiveId(event.target.value);
                setColleagueId("");
                setTakeId("");
              }}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
            >
              <option value="">Choose a shift</option>
              {myShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatPerthDay(perthDateOf(shift.startsAt))} · {shift.shiftCode}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {give ? (
          <RosterSwapTicket shift={give} label={swap && swap.requesterId !== actorId ? "Their shift" : "Your shift"} />
        ) : null}
        {fresh && !swap && give ? (
          <>
            <label className="grid gap-1 text-sm">
              Colleague
              <select
                value={colleagueId}
                onChange={(event) => {
                  setColleagueId(event.target.value);
                  setTakeId("");
                }}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <option value="">Choose someone free</option>
                {candidates.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.name ?? "Colleague"} · {candidate.grade}
                    {candidate.shortBreak ? " · break needs checking" : ""}
                  </option>
                ))}
              </select>
            </label>
            {candidates.length === 0 ? <p>No eligible colleague is free for this shift.</p> : null}
            {chosen ? (
              <label className="grid gap-1 text-sm">
                Shift in return (optional)
                <select
                  value={takeId}
                  onChange={(event) => setTakeId(event.target.value)}
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
                >
                  <option value="">No shift in return</option>
                  {colleagueShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      Offers {formatPerthDay(perthDateOf(shift.startsAt))} in return
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
        {take ? (
          <RosterSwapTicket
            shift={take}
            label={swap && swap.counterpartyId === actorId ? "Your shift in return" : "Their shift in return"}
          />
        ) : null}
        {fresh && give && counterparty ? (
          <div className="grid gap-2 text-sm">
            <p>
              {reviewingCounterparty
                ? take
                  ? `You'll be off ${formatPerthDay(perthDateOf(take.startsAt))} and on ${formatPerthDay(perthDateOf(give.startsAt))}.`
                  : `You'll be on ${formatPerthDay(perthDateOf(give.startsAt))}.`
                : take
                  ? `You'll be off ${formatPerthDay(perthDateOf(give.startsAt))} and on ${formatPerthDay(perthDateOf(take.startsAt))}.`
                  : `You'll be off ${formatPerthDay(perthDateOf(give.startsAt))}.`}
            </p>
            <p>{clash ? "A shift clash was found. This swap can't be sent." : "No clashes found"}</p>
            <p>
              Breaks before: you{" "}
              {hoursSinceLastShift(
                fresh.assignments,
                actorId,
                reviewingCounterparty ? give.startsAt : (take?.startsAt ?? give.startsAt),
              ) ?? "—"}{" "}
              h,{" "}
              {reviewingCounterparty
                ? (swap?.requesterName ?? "your colleague")
                : (swap?.counterpartyName ?? chosen?.name ?? "your colleague")}{" "}
              {hoursSinceLastShift(
                fresh.assignments,
                reviewingCounterparty ? swap!.requesterId : counterparty,
                reviewingCounterparty ? (take?.startsAt ?? give.startsAt) : give.startsAt,
              ) ?? "—"}{" "}
              h
            </p>
            {fresh.overview.settings.rules.minBreakHours != null ? (
              <p>Rule {fresh.overview.settings.rules.minBreakHours} h</p>
            ) : null}
            <p>
              {managerReason
                ? `Needs your manager because ${reasonWords[managerReason]}`
                : `Both ${give.grade ? `${give.grade}s` : "colleagues"}, so it approves itself`}
            </p>
            <p className="text-[color:var(--text-muted)]">Rechecked {checkedTime(fresh.readAt)}</p>
          </div>
        ) : null}
        {undoId || canUndo ? (
          <Button variant="secondary" disabled={busy} onClick={() => void act("swap.undo")}>
            Undo for 10 min
          </Button>
        ) : null}
        {askSide ? (
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void act("swap.decline")}>
              Decline
            </Button>
            <Button variant="primary" disabled={busy || !!clash} onClick={() => void act("swap.accept")}>
              Accept swap
            </Button>
          </div>
        ) : null}
        {canCreate ? (
          <Button variant="primary" disabled={busy} onClick={() => void act("swap.create")}>
            Send swap
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
