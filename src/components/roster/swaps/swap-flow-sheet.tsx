"use client";

import { useEffect, useMemo, useState } from "react";

import { GIVE_AWAY_WORDS, isUrgentGiveAway } from "@/components/roster/requests/request-ui";
import { RosterSwapTicket } from "@/components/roster/requests/roster-swap-ticket";
import { formatShiftRange, useRosterNow } from "@/components/roster/roster-format";
import { useDelayedRosterAction } from "@/components/roster/swaps/use-delayed-roster-action";
import { fetchRosterRead, postRosterAction } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { isoWeekday } from "@/lib/roster/team/cover";
import { openShiftCandidates, placementProblem, swapNeedsManager } from "@/lib/roster/team/eligibility";
import type { RosterAssignment, RosterOverview, RosterSwap } from "@/lib/roster/team/model";
import { swapProgress } from "@/lib/roster/team/swap-progress";
import { approvalWords, reasonWords, swapOptions, swapPreview } from "@/lib/roster/team/swap-options";

/**
 * The calendar-first swap flow: pick who, pick what to take back, check, then
 * send. Sending is held for 10 seconds under an Undo (see
 * `useDelayedRosterAction`). Everything shown is advice worked out from a
 * fresh read; the server rechecks when the swap is created or accepted, and a
 * refusal is shown in plain words and the roster is read again.
 */

type Fresh = { assignments: RosterAssignment[]; overview: RosterOverview; readAt: Date };
type Step = "who" | "take" | "check";

const UNNAMED = "Name not available";
const PANEL = "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3";
const CHOICE = "w-full justify-start text-left";

function checkedTime(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

/** The Monday-to-Sunday weeks around a shift, about eight of them, inside the server's read limit. */
function readWindow(shiftStart: string, now: Date): { from: string; to: string } {
  const today = perthDateOf(now);
  const shiftDate = perthDateOf(shiftStart);
  let anchor = shiftDate < today ? shiftDate : today;
  if (shiftDate > addDaysToDate(today, 48)) anchor = addDaysToDate(shiftDate, -7);
  const from = addDaysToDate(anchor, 1 - isoWeekday(anchor));
  return { from, to: addDaysToDate(from, 55) };
}

function useFreshRead(serviceId: string, shiftStart: string) {
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let current = true;
    void Promise.all([
      fetchRosterRead(serviceId, "assignments", readWindow(shiftStart, new Date())),
      fetchRosterRead(serviceId, "overview"),
    ]).then(([assignments, overview]) => {
      if (!current) return;
      if (!assignments.ok || !overview.ok) {
        setLoadError("The team roster couldn't be checked. Close this and try again.");
        return;
      }
      setLoadError(null);
      setFresh({ assignments: assignments.data.assignments, overview: overview.data, readAt: assignments.readAt });
    });
    return () => {
      current = false;
    };
  }, [serviceId, shiftStart, generation]);
  return { fresh, loadError, reread: () => setGeneration((value) => value + 1) };
}

function shiftLine(shift: RosterAssignment): string {
  return `${formatPerthDay(perthDateOf(shift.startsAt))} · ${SHIFT_KIND_LABEL[shift.kind]} ${formatShiftRange(shift)}`;
}

function WeekList({ label, shifts }: { label: string; shifts: readonly RosterAssignment[] }) {
  return (
    <div>
      <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
      {shifts.length ? (
        <ul aria-label={label} className="grid gap-0.5 text-sm">
          {shifts.map((shift) => (
            <li key={shift.id} className="nums">
              {shiftLine(shift)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">No shifts</p>
      )}
    </div>
  );
}

function WeekPreview({
  title,
  before,
  after,
}: {
  title: string;
  before: readonly RosterAssignment[];
  after: readonly RosterAssignment[];
}) {
  return (
    <section className={PANEL}>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="grid gap-3">
        <WeekList label={`${title} before`} shifts={before} />
        <WeekList label={`${title} after`} shifts={after} />
      </div>
    </section>
  );
}

const grade = (value: string | null) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Grade not set");

export function SwapFlowSheet(props: {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  actorId: string;
  give: RosterAssignment;
  mode: "swap" | "give_away";
  onSent: (label: string) => void;
}) {
  // A new session for each shift and mode, so nothing chosen earlier carries over.
  return props.open ? (
    <FlowSession key={JSON.stringify([props.serviceId, props.actorId, props.give.id, props.mode])} {...props} />
  ) : null;
}

function FlowSession({ onClose, serviceId, actorId, give, mode, onSent }: Parameters<typeof SwapFlowSheet>[0]) {
  const now = useRosterNow();
  const { fresh, loadError, reread } = useFreshRead(serviceId, give.startsAt);
  const { pending, sending, canSend, schedule, undo } = useDelayedRosterAction();
  const [step, setStep] = useState<Step>("who");
  const [colleagueId, setColleagueId] = useState("");
  // null until chosen; "" means "Nothing, just take my shift".
  const [takeId, setTakeId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const options = useMemo(
    () =>
      fresh && mode === "swap"
        ? swapOptions({
            rows: fresh.assignments,
            give,
            me: { userId: actorId, grade: fresh.overview.me.grade },
            settings: fresh.overview.settings,
            now,
          })
        : null,
    [fresh, mode, give, actorId, now],
  );
  const chosen = options?.can.find((choice) => choice.userId === colleagueId) ?? null;
  const take = takeId ? (chosen?.takeBack.find((shift) => shift.id === takeId) ?? null) : null;
  // If a re-read means the choice no longer holds, step back to where it can be made again.
  const shown: Step = !chosen ? "who" : step === "check" && takeId && !take ? "take" : step;

  const giveAwayPeople = useMemo(
    () =>
      fresh && mode === "give_away"
        ? openShiftCandidates(
            fresh.assignments,
            { startsAt: give.startsAt, endsAt: give.endsAt, minGrade: give.grade, assignmentId: give.id },
            fresh.overview.settings,
            actorId,
          )
        : [],
    [fresh, mode, give, actorId],
  );

  // A shift starting within a day is reported to the manager, as the Requests give-away does.
  const urgent = mode === "give_away" && isUrgentGiveAway(give.startsAt, now);

  function close() {
    undo();
    onClose();
  }

  function goStep(next: Step) {
    setRefusal(null);
    setStep(next);
  }

  function send() {
    if (!fresh) return;
    setRefusal(null);
    setCancelled(false);
    const onFailed = (message: string) => {
      setRefusal(message);
      reread();
    };
    if (urgent) {
      schedule({
        label: "Telling your manager",
        serviceId,
        action: { action: "open.report", assignmentId: give.id },
        onDone: () => {
          onSent(GIVE_AWAY_WORDS.told);
          onClose();
        },
        onFailed,
      });
      return;
    }
    if (mode === "give_away") {
      const names = giveAwayPeople.map((person) => person.name ?? "colleague").join(" and ");
      schedule({
        label: "Offering this shift to your team",
        serviceId,
        action: { action: "open.post", assignmentId: give.id },
        onDone: () => {
          onSent(`Offered to ${names || "your team"}`);
          onClose();
        },
        onFailed,
      });
      return;
    }
    if (!chosen) return;
    schedule({
      label: `Swap with ${chosen.name ?? "your colleague"}`,
      serviceId,
      action: {
        action: "swap.create",
        giveAssignmentId: give.id,
        counterpartyId: chosen.userId,
        takeAssignmentId: take?.id ?? null,
      },
      onDone: () => {
        onSent("Swap sent");
        onClose();
      },
      onFailed,
    });
  }

  function cancelSend() {
    undo();
    setCancelled(true);
  }

  const managerReason =
    fresh && chosen
      ? swapNeedsManager({
          give,
          take,
          giverGrade: give.grade ?? fresh.overview.me.grade,
          takerGrade: chosen.grade,
          counterpartyId: chosen.userId,
          settings: fresh.overview.settings,
          assignments: fresh.assignments,
          now,
        })
      : null;
  const preview = fresh && chosen ? swapPreview(fresh.assignments, give, take, actorId, chosen.userId) : null;

  // While the hold runs, and while the server is answering, there is no Send button to tap again.
  const sendControls = sending ? (
    <p role="status" className={PANEL}>
      Sending…
    </p>
  ) : pending ? (
    <div role="status" className={`${PANEL} grid gap-2`}>
      <p className="font-medium">Sending in 10 seconds</p>
      <p className="text-sm">{pending}. Closing this window cancels it.</p>
      <Button variant="secondary" onClick={cancelSend}>
        Undo
      </Button>
    </div>
  ) : null;
  const signInNote = canSend ? null : <p role="status">Sign in to send</p>;

  return (
    <Sheet
      open
      onClose={close}
      title={mode === "swap" ? "Swap this shift" : urgent ? GIVE_AWAY_WORDS.urgentTitle : "Give this shift away"}
    >
      <div className="grid gap-4">
        {!fresh && !loadError ? <p role="status">Checking the team roster…</p> : null}
        {loadError ? <p role="alert">{loadError}</p> : null}
        {refusal ? <p role="alert">{refusal}</p> : null}
        {cancelled && !pending ? <p role="status">Cancelled before sending.</p> : null}
        <RosterSwapTicket shift={give} label="Your shift" />

        {fresh && mode === "swap" && options && shown === "who" ? (
          <>
            <p className="text-xs text-[color:var(--text-muted)]">Step 1 of 3 · Who</p>
            <section className="grid gap-2">
              <h3 className="text-base font-medium">Can swap</h3>
              {options.can.length ? (
                options.can.map((choice) => (
                  <Button
                    key={choice.userId}
                    className={CHOICE}
                    onClick={() => {
                      setColleagueId(choice.userId);
                      setTakeId(null);
                      goStep("take");
                    }}
                  >
                    <span>
                      {choice.name ?? UNNAMED}
                      <span className="block text-xs font-normal text-[color:var(--text-muted)]">
                        {grade(choice.grade)} · {choice.sameGrade ? "same grade" : "higher grade"}
                      </span>
                    </span>
                  </Button>
                ))
              ) : (
                <p>Nobody on the roster can take this shift at the moment.</p>
              )}
            </section>
            {options.cannot.length ? (
              <section className="grid gap-2">
                <h3 className="text-base font-medium">Can&apos;t swap</h3>
                <ul className="grid gap-2">
                  {options.cannot.map((blocked) => (
                    <li key={blocked.userId} className={PANEL}>
                      <span className="font-medium">{blocked.name ?? UNNAMED}</span>
                      <span className="block text-sm text-[color:var(--text-muted)]">{blocked.words}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {fresh && mode === "swap" && chosen && shown === "take" ? (
          <>
            <p className="text-xs text-[color:var(--text-muted)]">Step 2 of 3 · Take back</p>
            <section className="grid gap-2">
              <h3 className="text-base font-medium">What would you take from {chosen.name ?? UNNAMED}?</h3>
              <Button
                className={CHOICE}
                onClick={() => {
                  setTakeId("");
                  goStep("check");
                }}
              >
                Nothing, just take my shift
              </Button>
              {chosen.takeBack.map((shift) => (
                <Button
                  key={shift.id}
                  className={CHOICE}
                  onClick={() => {
                    setTakeId(shift.id);
                    goStep("check");
                  }}
                >
                  {shiftLine(shift)}
                </Button>
              ))}
            </section>
            <Button variant="ghost" onClick={() => goStep("who")}>
              Back
            </Button>
          </>
        ) : null}

        {fresh && mode === "swap" && chosen && preview && shown === "check" ? (
          <>
            <p className="text-xs text-[color:var(--text-muted)]">Step 3 of 3 · Check and send</p>
            <h3 className="text-base font-medium">Swap with {chosen.name ?? UNNAMED}</h3>
            {take ? <RosterSwapTicket shift={take} label="Their shift in return" /> : <p>You take nothing back.</p>}
            <WeekPreview title="Your week" before={preview.mine.before} after={preview.mine.after} />
            <WeekPreview
              title={`${chosen.name ?? "Their"} week`}
              before={preview.theirs.before}
              after={preview.theirs.after}
            />
            <p>{approvalWords(managerReason)}</p>
            <p className="text-xs text-[color:var(--text-muted)]">Rechecked {checkedTime(fresh.readAt)}</p>
            {sendControls ?? (
              <div className="grid gap-2">
                {signInNote}
                <Button variant="primary" disabled={!canSend} onClick={send}>
                  Send swap request
                </Button>
                <Button variant="ghost" onClick={() => goStep("take")}>
                  Back
                </Button>
              </div>
            )}
          </>
        ) : null}

        {fresh && mode === "give_away" ? (
          <>
            <h3 className="text-base font-medium">
              Who can take it: {giveAwayPeople.length} {giveAwayPeople.length === 1 ? "person" : "people"}
            </h3>
            <ul className="grid gap-1 text-sm">
              {giveAwayPeople.map((person) => (
                <li key={person.userId}>
                  {person.name ?? UNNAMED} · {grade(person.grade)}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[color:var(--text-muted)]">Rechecked {checkedTime(fresh.readAt)}</p>
            {urgent ? <p>{GIVE_AWAY_WORDS.ringIn}</p> : null}
            {sendControls ?? (
              <>
                {signInNote}
                <Button
                  variant="primary"
                  disabled={!canSend || (!urgent && giveAwayPeople.length === 0)}
                  onClick={send}
                >
                  {urgent
                    ? GIVE_AWAY_WORDS.urgentButton
                    : `Offer to ${giveAwayPeople.length === 1 ? "1 person" : `${giveAwayPeople.length} people`}`}
                </Button>
              </>
            )}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * A swap someone sent to me: what they give, what they get, my week before
 * and after, and Accept or Decline. A swap that has ended (Expired included)
 * offers neither.
 */
export function SwapAnswerCard({
  swap,
  serviceId,
  actorId,
  onDone,
}: {
  swap: RosterSwap;
  serviceId: string;
  actorId: string;
  onDone: (label: string) => void;
}) {
  const now = useRosterNow();
  const { fresh, loadError, reread } = useFreshRead(serviceId, swap.give?.startsAt ?? swap.createdAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoable, setUndoable] = useState(false);
  const { give, take } = swap;
  if (!give) return <p role="alert">That swap changed. Refresh Requests.</p>;

  const progress = swapProgress(swap, actorId, now);
  const canAnswer = swap.counterpartyId === actorId && swap.status === "requested" && progress.ended === null;
  const canUndo =
    undoable ||
    (swap.status === "approved" &&
      swap.autoApproved &&
      !!swap.decidedAt &&
      now.getTime() < Date.parse(swap.decidedAt) + 600_000);
  const clash = fresh
    ? placementProblem(fresh.assignments, actorId, give.startsAt, give.endsAt, [take?.id], null)
    : null;
  const preview = fresh ? swapPreview(fresh.assignments, give, take, swap.requesterId, swap.counterpartyId) : null;
  const mine = preview ? (actorId === swap.requesterId ? preview.mine : preview.theirs) : null;
  const who = swap.requesterName ?? "They";

  async function act(action: "swap.accept" | "swap.decline" | "swap.undo") {
    setBusy(true);
    setError(null);
    const result = await postRosterAction(serviceId, { action, swapId: swap.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      reread();
      return;
    }
    if (action === "swap.undo") {
      setUndoable(false);
      onDone("Swap undone");
    } else if (action === "swap.accept") {
      setUndoable(!!result.result.autoApproved);
      onDone(result.result.autoApproved ? "Swap approved itself" : "Swap accepted");
    } else onDone("Swap declined");
  }

  return (
    <div className="grid gap-3">
      {loadError ? <p role="alert">{loadError}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <RosterSwapTicket shift={give} label={`${who} give`} />
      {take ? (
        <RosterSwapTicket shift={take} label={`${who} get`} />
      ) : (
        <p>{who} get nothing back. You just take the shift.</p>
      )}
      {mine ? <WeekPreview title="Your week" before={mine.before} after={mine.after} /> : null}
      {progress.ended ? <p>{progress.ended}</p> : null}
      {canAnswer ? (
        <>
          <p>
            {swap.needsManagerBecause
              ? `Your manager also needs to approve because ${reasonWords[swap.needsManagerBecause]}.`
              : "It goes through as soon as you accept."}
          </p>
          {clash ? <p role="alert">A shift clash was found, so this swap can&apos;t be accepted.</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => void act("swap.decline")}>
              Decline
            </Button>
            <Button variant="primary" disabled={busy || !!clash} onClick={() => void act("swap.accept")}>
              Accept swap
            </Button>
          </div>
        </>
      ) : null}
      {canUndo ? (
        <Button variant="secondary" disabled={busy} onClick={() => void act("swap.undo")}>
          Undo for 10 min
        </Button>
      ) : null}
    </div>
  );
}
