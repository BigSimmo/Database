"use client";

import { focusRing } from "@/components/card-recipes";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { modeInsetHairline, modePressable } from "@/components/mode-kit/recipes";
import { formatShiftRange } from "@/components/roster/roster-format";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { formatPerthDay } from "@/lib/roster/shifts/perth-time";
import type { RosterAssignment } from "@/lib/roster/team/model";
import { groupByGrade } from "@/lib/roster/team/team-view";

/** Everyone working on one day, grouped by grade. Picking a shift hands it on. */
export function DaySheet({
  date,
  rows,
  actorId,
  onPickShift,
  onClose,
}: {
  date: string;
  rows: readonly RosterAssignment[];
  actorId: string | null;
  onPickShift: (shift: RosterAssignment) => void;
  onClose: () => void;
}) {
  const groups = groupByGrade(rows);
  return (
    <Sheet open onClose={onClose} title={formatPerthDay(date)}>
      {groups.length ? (
        groups.map((group) => (
          <ModeGroupedList key={group.label} eyebrow={group.label} mode="roster">
            {group.assignments.map((row) => (
              <li key={row.id} className={cn(modeInsetHairline, "flex min-w-0")}>
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
              </li>
            ))}
          </ModeGroupedList>
        ))
      ) : (
        <p>No shifts on this day.</p>
      )}
    </Sheet>
  );
}
