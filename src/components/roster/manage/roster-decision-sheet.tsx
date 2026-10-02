"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RosterSwapTicket } from "@/components/roster/requests/roster-swap-ticket";
import { fetchRosterRead, postRosterAction } from "@/components/roster/use-roster-team";
import { addDaysToDate, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import type {
  RosterAction,
  RosterManageOpenShift,
  RosterManageSwap,
  SwapNeedsManagerReason,
} from "@/lib/roster/team/model";

export const managerReason: Record<SwapNeedsManagerReason, string> = {
  team_setting: "Needs you because your team approves every swap",
  within_7_days: "Needs you because it's within 7 days",
  different_grade: "Needs you because they're different grades",
  team_rule: "Needs you because it breaks a team rule",
};
export type ManagerDecision = { kind: "swap"; item: RosterManageSwap } | { kind: "open"; item: RosterManageOpenShift };

export function RosterDecisionSheet({
  serviceId,
  decision,
  onClose,
  onChanged,
}: {
  serviceId: string;
  decision: ManagerDecision;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [checked, setChecked] = useState<Date | null>(null);
  const [current, setCurrent] = useState<ManagerDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const startsAt = decision.kind === "swap" ? decision.item.give?.startsAt : decision.item.startsAt;
    const day = perthDateOf(startsAt ?? new Date());
    void Promise.all([
      fetchRosterRead(serviceId, "assignments", { from: addDaysToDate(day, -7), to: addDaysToDate(day, 7) }),
      fetchRosterRead(serviceId, "manage"),
    ]).then(([assignments, manage]) => {
      if (!alive) return;
      if (!assignments.ok || !manage.ok) {
        setError("The roster could not be rechecked. Close and try again.");
        return;
      }
      if (decision.kind === "swap") {
        const item = manage.data.swaps.find((row) => row.id === decision.item.id && row.status === "accepted");
        if (item) setCurrent({ kind: "swap", item });
        else setError("This request has changed. Close to refresh the list.");
      } else {
        const item = manage.data.openShifts.find(
          (row) => row.id === decision.item.id && ["reported", "claimed"].includes(row.status),
        );
        if (item) setCurrent({ kind: "open", item });
        else setError("This request has changed. Close to refresh the list.");
      }
      setChecked(assignments.readAt);
    });
    return () => {
      alive = false;
    };
  }, [decision, serviceId]);
  async function act(approve: boolean) {
    if (!current || busy) return;
    const action: RosterAction =
      current.kind === "swap"
        ? { action: approve ? "swap.approve" : "swap.decline", swapId: current.item.id }
        : current.item.status === "reported"
          ? approve
            ? { action: "open.release", openShiftId: current.item.id, urgent: true }
            : { action: "open.cancel", openShiftId: current.item.id }
          : { action: approve ? "open.approve" : "open.decline", openShiftId: current.item.id };
    setBusy(true);
    const result = await postRosterAction(serviceId, action);
    setBusy(false);
    onChanged();
    if (!result.ok) {
      setError(result.message);
      setCurrent(null);
      return;
    }
    onClose();
  }
  return (
    <Sheet
      open
      onClose={() => {
        onChanged();
        onClose();
      }}
      title={decision.kind === "swap" ? "Review swap" : "Review cover"}
    >
      <div className="grid gap-4 p-4">
        {current?.kind === "swap" ? (
          <>
            {current.item.give ? <RosterSwapTicket shift={current.item.give} label="Gives" /> : null}
            {current.item.take ? <RosterSwapTicket shift={current.item.take} label="Takes" /> : null}
            {current.item.needsManagerBecause ? <p>{managerReason[current.item.needsManagerBecause]}</p> : null}
          </>
        ) : current ? (
          <p>
            {current.item.shiftCode} · {current.item.kind} · {perthTimeOf(current.item.startsAt)}–
            {perthTimeOf(current.item.endsAt)}
          </p>
        ) : null}
        {checked ? (
          <p className="text-sm text-muted-foreground">
            Rechecked {perthTimeOf(checked.toISOString())}. Eligibility is checked again when you decide.
          </p>
        ) : (
          <p>Rechecking the live roster…</p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={!current || busy} onClick={() => void act(false)}>
            {current?.kind === "open" && current.item.status === "reported" ? "Cancel request" : "Decline"}
          </Button>
          <Button disabled={!current || busy} onClick={() => void act(true)}>
            {current?.kind === "open" && current.item.status === "reported" ? "Post to team" : "Approve"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
