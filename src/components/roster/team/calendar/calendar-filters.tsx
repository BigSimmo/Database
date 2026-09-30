"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CalendarShow } from "@/lib/roster/team/calendar-model";
import { ROSTER_GRADES, type RosterGrade } from "@/lib/roster/team/model";

export type CalendarPerson = { userId: string; name: string };

const SELECT_CLASS = "min-h-12 w-full min-w-0 rounded border bg-background p-2";

function gradeName(grade: RosterGrade): string {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

/**
 * Who the calendar shows. It only ever narrows the rows already read for the
 * window, so changing it never asks the server for anything.
 */
export function CalendarFilters({
  show,
  canFilterToMe,
  people,
  onChange,
}: {
  show: CalendarShow;
  canFilterToMe: boolean;
  people: readonly CalendarPerson[];
  onChange: (show: CalendarShow) => void;
}) {
  const other = show.kind === "grade" || show.kind === "person" || show.kind === "compare";
  const segment = show.kind === "me" ? "me" : other ? "filtered" : "everyone";
  return (
    <div className="grid gap-2">
      <SegmentedControl
        label="Show"
        layout="equal"
        value={segment}
        onChange={(value) => {
          if (value === "me") onChange({ kind: "me" });
          else if (value === "everyone") onChange({ kind: "everyone" });
        }}
        options={[
          { value: "everyone", label: "Everyone" },
          { value: "me", label: "Just me", disabled: !canFilterToMe },
          ...(other ? [{ value: "filtered", label: "Filtered" }] : []),
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          Grade
          <select
            className={SELECT_CLASS}
            value={show.kind === "grade" ? show.grade : ""}
            onChange={(event) => {
              const grade = ROSTER_GRADES.find((item) => item === event.target.value);
              onChange(grade ? { kind: "grade", grade } : { kind: "everyone" });
            }}
          >
            <option value="">All grades</option>
            {ROSTER_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {gradeName(grade)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Person
          <select
            className={SELECT_CLASS}
            value={show.kind === "person" || show.kind === "compare" ? show.userId : ""}
            onChange={(event) =>
              onChange(event.target.value ? { kind: "person", userId: event.target.value } : { kind: "everyone" })
            }
          >
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
