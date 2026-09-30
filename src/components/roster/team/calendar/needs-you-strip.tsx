"use client";

import { useState } from "react";

import { managerReason } from "@/components/roster/manage/roster-decision-sheet";
import { postRosterAction } from "@/components/roster/use-roster-team";
import { Button } from "@/components/ui/button";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import type { RosterAction, RosterManageOpenShift, RosterManageSwap } from "@/lib/roster/team/model";
import type { RuleFlag } from "@/lib/roster/team/rule-flags";

type Post = (action: RosterAction) => ReturnType<typeof postRosterAction>;
type Flags = ReadonlyMap<string, readonly RuleFlag[]>;

export type ApproveAllResult = {
  approved: number;
  refused: { id: string; message: string }[];
  /** Swaps with a rule warning, left for the manager to read. */
  warned: string[];
  /** Swaps whose rules could not be checked, left for the manager to open. */
  notChecked: string[];
};

const SHORT_DAYS_SHOWN = 6;

function swapHasWarning(swap: RosterManageSwap, flags: Flags): boolean {
  return [swap.give, swap.take].some((side) => side !== null && (flags.get(side.id)?.length ?? 0) > 0);
}

/**
 * Approves the waiting swaps that could be checked and carry no rule flag, one
 * at a time so each is rechecked by the server on its own. `checkable` names
 * the swaps whose rules were really checked (see `useManagerCalendar`); a swap
 * outside it is reported as not checked and never approved. A swap with a flag
 * is left for the manager to read; a swap the server refuses is reported with
 * the server's own words and never counted as approved.
 */
export async function approveAllWithoutWarnings(
  pending: readonly RosterManageSwap[],
  flags: Flags,
  post: Post,
  checkable?: ReadonlySet<string>,
): Promise<ApproveAllResult> {
  const result: ApproveAllResult = { approved: 0, refused: [], warned: [], notChecked: [] };
  for (const swap of pending) {
    if (checkable && !checkable.has(swap.id)) {
      result.notChecked.push(swap.id);
      continue;
    }
    if (swapHasWarning(swap, flags)) {
      result.warned.push(swap.id);
      continue;
    }
    const sent = await post({ action: "swap.approve", swapId: swap.id });
    if (sent.ok) result.approved += 1;
    else result.refused.push({ id: swap.id, message: sent.message });
  }
  return result;
}

/**
 * Sends a manager's decisions for one team and keeps the answer to show: one
 * decision at a time, the server's words when it refuses. The strip and the
 * shift sheet both decide through this, so a swap is approved the same way
 * from either place.
 */
export function useRosterDecision(serviceId: string, onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const post: Post = (action) => postRosterAction(serviceId, action);

  async function decide(action: RosterAction) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors([]);
    const sent = await post(action);
    setBusy(false);
    if (!sent.ok) setErrors([sent.message]);
    onChanged();
  }

  async function approveAll(pending: readonly RosterManageSwap[], flags: Flags, checkable: ReadonlySet<string>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors([]);
    const outcome = await approveAllWithoutWarnings(pending, flags, post, checkable);
    setBusy(false);
    setMessage(
      [
        `Approved ${outcome.approved}.`,
        outcome.warned.length
          ? `${outcome.warned.length} left for you to read because a shift has a rule warning.`
          : null,
        outcome.notChecked.length
          ? `${outcome.notChecked.length} not checked, open ${outcome.notChecked.length === 1 ? "it" : "them"} to review.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setErrors(outcome.refused.map((item) => item.message));
    onChanged();
  }

  return { busy, message, errors, decide, approveAll };
}

const who = (name: string | null | undefined, fallback: string | null | undefined) =>
  name ?? fallback ?? "A team member";

function swapTitle(swap: RosterManageSwap): string {
  return `Swap · ${who(swap.requesterName, swap.give?.name)} and ${who(swap.counterpartyName, swap.take?.name)}`;
}

function openTitle(shift: RosterManageOpenShift): string {
  return `${SHIFT_KIND_LABEL[shift.kind]} on ${formatPerthDay(perthDateOf(shift.startsAt))} was taken · needs your approval`;
}

/**
 * One waiting swap with Approve and Decline in place. `checkable` is given by
 * the strip, where a swap that could not be checked says so; the shift sheet
 * leaves it out, since the manager is already looking at the swap.
 */
export function SwapDecisionRow({
  swap,
  flags,
  checkable,
  busy,
  onDecide,
}: {
  swap: RosterManageSwap;
  flags: Flags;
  checkable?: ReadonlySet<string>;
  busy: boolean;
  onDecide: (action: RosterAction) => void;
}) {
  return (
    <div className="grid gap-2">
      <span id={`needs-${swap.id}`}>{swapTitle(swap)}</span>
      {swap.needsManagerBecause ? (
        <span className="text-sm text-[color:var(--text-muted)]">{managerReason[swap.needsManagerBecause]}</span>
      ) : null}
      {swapHasWarning(swap, flags) ? (
        <span className="text-sm text-[color:var(--warning-text)]">A shift in this swap has a rule warning</span>
      ) : null}
      {checkable && !checkable.has(swap.id) ? (
        <span className="text-sm text-[color:var(--text-muted)]">Not checked, open it to review</span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          className="min-h-12"
          disabled={busy}
          aria-describedby={`needs-${swap.id}`}
          onClick={() => onDecide({ action: "swap.approve", swapId: swap.id })}
        >
          Approve
        </Button>
        <Button
          className="min-h-12"
          disabled={busy}
          aria-describedby={`needs-${swap.id}`}
          onClick={() => onDecide({ action: "swap.decline", swapId: swap.id })}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

/** The decision's answer: what "Approve all" did, and any refusal in the server's words. */
export function DecisionAnswer({ message, errors }: { message: string | null; errors: readonly string[] }) {
  return (
    <>
      {message ? <p role="status">{message}</p> : null}
      {errors.length ? (
        <div role="alert" className="grid gap-1">
          {errors.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * What is waiting on the manager, above the calendar: swaps and taken open
 * shifts to decide, and days that are short of the team's targets.
 */
export function NeedsYouStrip({
  serviceId,
  pending,
  claimed,
  shortDays,
  flags,
  checkable,
  onChanged,
  onPickDay,
}: {
  serviceId: string;
  pending: readonly RosterManageSwap[];
  claimed: readonly RosterManageOpenShift[];
  shortDays: readonly string[];
  flags: Flags;
  checkable: ReadonlySet<string>;
  onChanged: () => void;
  onPickDay: (date: string) => void;
}) {
  const { busy, message, errors, decide, approveAll } = useRosterDecision(serviceId, onChanged);
  if (!pending.length && !claimed.length && !shortDays.length) return null;

  const approvable = pending.filter((swap) => checkable.has(swap.id) && !swapHasWarning(swap, flags)).length;

  return (
    <section aria-label="Needs you" className="grid gap-3 rounded-xl border border-[color:var(--border)] p-3">
      <h2 className="text-base font-normal">Needs you</h2>
      {pending.length || claimed.length ? (
        <ul className="grid gap-2">
          {pending.map((swap) => (
            <li key={swap.id}>
              <SwapDecisionRow
                swap={swap}
                flags={flags}
                checkable={checkable}
                busy={busy}
                onDecide={(action) => void decide(action)}
              />
            </li>
          ))}
          {claimed.map((shift) => (
            <li key={shift.id} className="grid gap-2">
              <span id={`needs-${shift.id}`}>{openTitle(shift)}</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  className="min-h-12"
                  disabled={busy}
                  aria-describedby={`needs-${shift.id}`}
                  onClick={() => void decide({ action: "open.approve", openShiftId: shift.id })}
                >
                  Approve
                </Button>
                <Button
                  className="min-h-12"
                  disabled={busy}
                  aria-describedby={`needs-${shift.id}`}
                  onClick={() => void decide({ action: "open.decline", openShiftId: shift.id })}
                >
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {pending.length ? (
        <Button
          className="min-h-12"
          disabled={busy || approvable === 0}
          onClick={() => void approveAll(pending, flags, checkable)}
        >
          Approve all without warnings
        </Button>
      ) : null}
      <DecisionAnswer message={message} errors={errors} />
      {shortDays.length ? (
        <div className="grid gap-1">
          <p className="text-sm text-[color:var(--text-muted)]">Short of your targets</p>
          <div className="flex flex-wrap gap-2">
            {shortDays.slice(0, SHORT_DAYS_SHOWN).map((date) => (
              <Button key={date} className="min-h-12" onClick={() => onPickDay(date)}>
                {formatPerthDay(date)}
              </Button>
            ))}
            {shortDays.length > SHORT_DAYS_SHOWN ? (
              <span className="self-center text-sm">{`and ${shortDays.length - SHORT_DAYS_SHOWN} more`}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
