"use client";

import { focusRing } from "@/components/card-recipes";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { modeInsetHairline, modePressable } from "@/components/mode-kit/recipes";
import { formatShiftRange, useRosterNow } from "@/components/roster/roster-format";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { formatPerthDay } from "@/lib/roster/shifts/perth-time";
import type { RosterAssignment } from "@/lib/roster/team/model";
import { groupByGrade } from "@/lib/roster/team/team-view";

import { canRequestShift } from "./shift-sheet";

/**
 * Everyone working on one day, grouped by grade. Picking a shift hands it on.
 * Swap and Give away sit on my own shifts that have not started, by the same
 * rule as the shift sheet.
 */
export function DaySheet({
  date,
  rows,
  actorId,
  now: suppliedNow,
  filtered = false,
  onPickShift,
  onSwap,
  onGiveAway,
  onClose,
}: {
  date: string;
  rows: readonly RosterAssignment[];
  actorId: string | null;
  now?: Date;
  /** A filter is hiding some people, so an empty day is "nothing to show" rather than "nobody". */
  filtered?: boolean;
  onPickShift: (shift: RosterAssignment) => void;
  onSwap?: (shift: RosterAssignment) => void;
  onGiveAway?: (shift: RosterAssignment) => void;
  onClose: () => void;
}) {
  const now = useRosterNow(suppliedNow);
  const groups = groupByGrade(rows);
  return (
    <Sheet open onClose={onClose} title={formatPerthDay(date)}>
      {groups.length ? (
        groups.map((group) => (
          <ModeGroupedList key={group.label} eyebrow={group.label} mode="roster">
            {group.assignments.map((row) => {
              const canRequest = canRequestShift(row, actorId, now);
              return (
                <li key={row.id} className={cn(modeInsetHairline, "flex min-w-0 flex-wrap items-center")}>
                  <button
                    type="button"
                    onClick={() => onPickShift(row)}
                    className={cn(
                      modePressable,
                      focusRing,
                      "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-1 text-left",
                    )}
                  >
                    <span className="break-words font-medium">
                      {row.userId === actorId ? "You" : (row.name ?? "Name not available")}
                    </span>
                    <span className="nums shrink-0 text-right text-sm">
                      {SHIFT_KIND_LABEL[row.kind]} · {formatShiftRange(row)}
                    </span>
                  </button>
                  {canRequest && (onSwap || onGiveAway) ? (
                    <div className="flex gap-2 px-3 pb-2">
                      {onSwap ? (
                        <Button className="min-h-12" onClick={() => onSwap(row)}>
                          Swap
                        </Button>
                      ) : null}
                      {onGiveAway ? (
                        <Button className="min-h-12" onClick={() => onGiveAway(row)}>
                          Give away
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ModeGroupedList>
        ))
      ) : (
        <p>{filtered ? "No shifts to show on this day." : "No shifts on this day."}</p>
      )}
    </Sheet>
  );
}
