"use client";

import { ListFilter } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import type { CalendarShow } from "@/lib/roster/team/calendar-model";
import { ROSTER_GRADES, type RosterGrade } from "@/lib/roster/team/model";

export type CalendarPerson = { userId: string; name: string };

const SELECT_CLASS = "min-h-12 w-full min-w-0 rounded border bg-background p-2";

function gradeName(grade: RosterGrade): string {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

type FilterProps = {
  show: CalendarShow;
  canFilterToMe: boolean;
  /** The reader, so "Compare with me" is never offered against themselves. */
  actorId: string | null;
  people: readonly CalendarPerson[];
  onChange: (show: CalendarShow) => void;
};

/** The active filter in a few words, for the Filter button. */
export function filterLabel(show: CalendarShow, people: readonly CalendarPerson[]): string {
  const name = (userId: string) => people.find((person) => person.userId === userId)?.name ?? "Name not available";
  switch (show.kind) {
    case "everyone":
      return "Everyone";
    case "me":
      return "Just me";
    case "with_me":
      return "With me";
    case "grade":
      return `${gradeName(show.grade)}s`;
    case "person":
      return name(show.userId);
    case "compare":
      return `You and ${name(show.userId)}`;
  }
}

/**
 * Who the calendar shows. It only ever narrows the rows already read for the
 * window, so changing it never asks the server for anything. A grade or a
 * person leaves no Show option chosen; with a colleague chosen, "Compare with
 * me" puts the two of you side by side.
 */
export function CalendarFilters({ show, canFilterToMe, actorId, people, onChange }: FilterProps) {
  const chosen = show.kind === "person" || show.kind === "compare" ? show.userId : null;
  const canCompare = canFilterToMe && chosen !== null && chosen !== actorId;
  return (
    <div className="grid gap-3">
      <SegmentedControl
        label="Show"
        layout="equal"
        value={show.kind}
        onChange={(value) => {
          if (value === "me") onChange({ kind: "me" });
          else if (value === "with_me") onChange({ kind: "with_me" });
          else if (value === "everyone") onChange({ kind: "everyone" });
        }}
        options={[
          { value: "everyone", label: "Everyone" },
          { value: "me", label: "Just me", disabled: !canFilterToMe },
          { value: "with_me", label: "With me", disabled: !canFilterToMe },
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
            value={chosen ?? ""}
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
      {canCompare && chosen !== null ? (
        <Button
          className="min-h-12"
          aria-pressed={show.kind === "compare"}
          onClick={() =>
            onChange(show.kind === "compare" ? { kind: "person", userId: chosen } : { kind: "compare", userId: chosen })
          }
        >
          Compare with me
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One compact "Filter" button, naming the active filter, that opens the
 * filters in a sheet. Each choice applies at once; the sheet stays open until
 * closed so a person can be chosen and then compared.
 */
export function CalendarFilterButton(props: FilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="min-h-12" icon={ListFilter} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {`Filter: ${filterLabel(props.show, props.people)}`}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter">
        <CalendarFilters {...props} />
      </Sheet>
    </>
  );
}
