"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRosterRead } from "@/components/roster/use-roster-team";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { managerReason, RosterDecisionSheet, type ManagerDecision } from "./roster-decision-sheet";

/** The manage reload shared with the calendar on the Manage page (see `ManagerTeam`). */
export type SharedManageReload = {
  round: number;
  changedBy: string;
  onChanged: (changedBy: string) => void;
};

export function RosterApproveTab({ serviceId, shared }: { serviceId: string; shared?: SharedManageReload }) {
  const manage = useRosterRead(serviceId, "manage");
  const reloadManage = manage.reload;
  const round = shared?.round ?? 0;
  const changedBy = shared?.changedBy;
  // Only a round started elsewhere after this tab opened; opening the tab reads afresh anyway.
  const seenRound = useRef(round);
  useEffect(() => {
    if (round === seenRound.current) return;
    seenRound.current = round;
    if (changedBy !== "approve") reloadManage();
  }, [round, changedBy, reloadManage]);
  const people = useRosterRead(serviceId, "people");
  const today = perthDateOf(new Date());
  const leave = useRosterRead(serviceId, "team_leave", { from: today, to: addDaysToDate(today, 61) });
  const [decision, setDecision] = useState<ManagerDecision | null>(null);
  if (!manage.data || !people.data)
    return (
      <div>
        <p>{manage.message ?? people.message ?? "Loading requests…"}</p>
        {manage.status === "error" || people.status === "error" ? (
          <Button
            onClick={() => {
              manage.reload();
              people.reload();
            }}
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  const names = new Map(
    people.data.people.map((person) => [person.userId, person.displayName ?? person.rosterName ?? "Team member"]),
  );
  const swaps = manage.data.swaps.filter((swap) => swap.status === "accepted");
  const open = manage.data.openShifts.filter((shift) => shift.status === "reported" || shift.status === "claimed");
  const auto = manage.data.swaps.filter((swap) => swap.status === "approved" && swap.autoApproved).length;
  const seen = manage.data.seen;
  return (
    <section className="grid gap-4" aria-label="Approve">
      <div className="flex flex-wrap gap-5 font-normal">
        <p>Waiting {swaps.length + open.length}</p>
        <p>Auto-approved {auto}</p>
        {seen ? (
          <p>
            Seen roster v{seen.version}: {seen.seen} of {seen.members}
          </p>
        ) : null}
      </div>
      {!swaps.length && !open.length ? <p>Nothing waiting for your decision.</p> : null}
      <ul className="divide-y rounded-xl border">
        {swaps.map((swap) => (
          <li key={swap.id}>
            <button
              className="grid min-h-12 w-full gap-1 p-4 text-left"
              onClick={() => setDecision({ kind: "swap", item: swap })}
            >
              <span>
                Swap · {names.get(swap.requesterId) ?? "Team member"} and{" "}
                {names.get(swap.counterpartyId) ?? "Team member"}
              </span>
              {swap.needsManagerBecause ? (
                <span className="text-sm text-muted-foreground">{managerReason[swap.needsManagerBecause]}</span>
              ) : null}
            </button>
          </li>
        ))}
        {open.map((shift) => (
          <li key={shift.id}>
            <button
              className="grid min-h-12 w-full gap-1 p-4 text-left"
              onClick={() => setDecision({ kind: "open", item: shift })}
            >
              <span>
                {shift.status === "reported"
                  ? `${names.get(shift.postedBy ?? "") ?? "A team member"} can't make ${formatPerthDay(perthDateOf(shift.startsAt))} ${shift.kind}`
                  : `Taken by ${names.get(shift.claimedBy ?? "") ?? "a team member"} · needs your approval`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {leave.data?.leave.length ? (
        <section className="grid gap-2">
          <h2>Planned leave</h2>
          <p className="text-sm text-muted-foreground">Leave is approved in HR.</p>
          {leave.data.leave.map((row, index) => (
            <p key={`${row.userId}-${row.startsOn}-${index}`}>
              Leave · {row.name ?? names.get(row.userId) ?? "Team member"} · {formatPerthDay(row.startsOn)}–
              {formatPerthDay(row.endsOn)}
            </p>
          ))}
        </section>
      ) : null}
      {decision ? (
        <RosterDecisionSheet
          serviceId={serviceId}
          decision={decision}
          onClose={() => setDecision(null)}
          onChanged={() => {
            manage.reload();
            shared?.onChanged("approve");
          }}
        />
      ) : null}
    </section>
  );
}
