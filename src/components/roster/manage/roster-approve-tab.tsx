"use client";

import { ArrowDown, CheckCheck, Eye, Hourglass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RosterStat } from "@/components/roster/roster-ui";
import { goToNeedsYou } from "@/components/roster/team/calendar/needs-you-strip";
import { useRosterRead } from "@/components/roster/use-roster-team";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { managerReason, RosterDecisionSheet, type ManagerDecision } from "./roster-decision-sheet";

/** The manage reload shared with the calendar on the Manage page (see `ManagerTeam`). */
export type SharedManageReload = {
  round: number;
  changedBy: string;
  onChanged: (changedBy: string) => void;
};

/** Same layout as `RosterStats`, as a list so the figures are read as a set. */
const STATS_GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3";

export function RosterApproveTab({
  serviceId,
  shared,
  decisionsInStrip = false,
  actorId = null,
}: {
  serviceId: string;
  shared?: SharedManageReload;
  /**
   * The calendar's Needs you strip is showing on this page, so waiting swaps
   * and taken shifts are decided there (inline, rechecked live) and this tab
   * points to it instead of listing them a second time.
   */
  decisionsInStrip?: boolean;
  /** The reader, whose own swaps the strip leaves out (the server refuses them). */
  actorId?: string | null;
}) {
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
  if (!manage.data || !people.data) {
    const failed = manage.status === "error" || people.status === "error";
    return (
      <div role={failed ? "alert" : "status"}>
        <p>{manage.message ?? people.message ?? "Loading requests…"}</p>
        {failed ? (
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
  }
  const names = new Map(
    people.data.people.map((person) => [person.userId, person.displayName ?? person.rosterName ?? "Team member"]),
  );
  const swaps = manage.data.swaps.filter(
    (swap) =>
      swap.status === "accepted" &&
      (!decisionsInStrip || (swap.requesterId !== actorId && swap.counterpartyId !== actorId)),
  );
  const open = manage.data.openShifts.filter((shift) => shift.status === "reported" || shift.status === "claimed");
  // The strip decides swaps and taken shifts; a shift someone can't make is only decided here.
  const inStrip = decisionsInStrip ? swaps.length + open.filter((shift) => shift.status === "claimed").length : 0;
  const listedSwaps = decisionsInStrip ? [] : swaps;
  const listedOpen = decisionsInStrip ? open.filter((shift) => shift.status === "reported") : open;
  const auto = manage.data.swaps.filter((swap) => swap.status === "approved" && swap.autoApproved).length;
  const seen = manage.data.seen;
  return (
    <section className="grid gap-4" aria-label="Approve">
      <ul className={STATS_GRID} aria-label="Summary">
        <li>
          <RosterStat
            icon={Hourglass}
            label="Waiting"
            value={swaps.length + open.length}
            testId="roster-stat-waiting"
          />
        </li>
        <li>
          <RosterStat icon={CheckCheck} label="Auto-approved" value={auto} testId="roster-stat-auto" />
        </li>
        {seen ? (
          <li>
            <RosterStat
              icon={Eye}
              label={`Seen roster v${seen.version}`}
              value={`${seen.seen} of ${seen.members}`}
              testId="roster-stat-seen"
            />
          </li>
        ) : null}
      </ul>
      {!swaps.length && !open.length ? <p>Nothing waiting for your decision.</p> : null}
      {inStrip ? (
        <div className="grid gap-2">
          <p className="text-sm text-[color:var(--text-muted)]">
            {`${inStrip} ${inStrip === 1 ? "request is" : "requests are"} in Needs you, beside the calendar, where you can approve or decline each one.`}
          </p>
          <Button icon={ArrowDown} onClick={goToNeedsYou}>
            Go to Needs you
          </Button>
        </div>
      ) : null}
      {listedSwaps.length || listedOpen.length ? (
        <ul className="divide-y rounded-xl border">
          {listedSwaps.map((swap) => (
            <li key={swap.id}>
              <button
                type="button"
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
          {listedOpen.map((shift) => (
            <li key={shift.id}>
              <button
                type="button"
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
      ) : null}
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
