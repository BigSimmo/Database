"use client";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatShiftRange, useRosterNow } from "@/components/roster/roster-format";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import type { RosterAssignment, RosterTeam } from "@/lib/roster/team/model";

/** Swap and Give away are offered only on my own shift that has not started. */
export function canRequestShift(shift: RosterAssignment, actorId: string | null, now: Date): boolean {
  return actorId !== null && shift.userId === actorId && Date.parse(shift.startsAt) > now.getTime();
}

/**
 * One shift in detail. Swap and Give away are offered only on my own shift
 * that has not started; the request sheets do the real checking.
 */
export function ShiftSheet({
  shift,
  team,
  actorId,
  now: suppliedNow,
  onClose,
  onSwap,
  onGiveAway,
}: {
  shift: RosterAssignment;
  team: RosterTeam;
  actorId: string | null;
  now?: Date;
  onClose: () => void;
  onSwap: (shift: RosterAssignment) => void;
  onGiveAway: (shift: RosterAssignment) => void;
}) {
  const now = useRosterNow(suppliedNow);
  const isMine = actorId !== null && shift.userId === actorId;
  const canRequest = canRequestShift(shift, actorId, now);
  const details: [string, string][] = [
    ["Who", isMine ? "You" : (shift.name ?? "Name not available")],
    ["Time", formatShiftRange(shift)],
    ...(shift.siteName ? [["Where", shift.siteName] as [string, string]] : []),
    ...(shift.grade ? [["Grade", shift.grade.charAt(0).toUpperCase() + shift.grade.slice(1)] as [string, string]] : []),
  ];
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${SHIFT_KIND_LABEL[shift.kind]} · ${formatPerthDay(perthDateOf(shift.startsAt))}`}
      description={team.name}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[color:var(--text-muted)]">{label}</dt>
            <dd className="nums">{value}</dd>
          </div>
        ))}
      </dl>
      {canRequest ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="min-h-12" onClick={() => onSwap(shift)}>
            Swap
          </Button>
          <Button className="min-h-12" onClick={() => onGiveAway(shift)}>
            Give away
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
