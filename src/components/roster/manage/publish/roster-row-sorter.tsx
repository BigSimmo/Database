"use client";

import type { MatchedRow } from "@/lib/roster/publish/match";
import type { RosterPerson } from "@/lib/roster/team/model";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { Button } from "@/components/ui/button";

export type RowChoice = { kind: "person"; userId: string } | { kind: "named" } | { kind: "open" };

export function RosterRowSorter({
  rows,
  people,
  choices,
  onChoose,
  onInvite,
}: {
  rows: readonly MatchedRow[];
  people: readonly RosterPerson[];
  choices: Readonly<Record<number, RowChoice>>;
  onChoose: (index: number, choice: RowChoice) => void;
  onInvite: (index: number) => void;
}) {
  const unresolved = rows.flatMap((row, index) =>
    choices[index]?.kind === "open" || (!(row.match && "userId" in row.match) && !choices[index])
      ? [{ row, index }]
      : [],
  );
  if (!unresolved.length) return null;
  return (
    <ModeGroupedList
      eyebrow={`Sort ${unresolved.length} ${unresolved.length === 1 ? "row" : "rows"}`}
      testId="roster-publish-sorter"
    >
      {unresolved.map(({ row, index }) => {
        const suggestionId = row.match && "suggestion" in row.match ? row.match.suggestion : null;
        const suggestion = suggestionId ? people.find((person) => person.userId === suggestionId) : null;
        return (
          <ModeRow
            key={`${row.rowName}-${index}`}
            title={row.rowName.trim() || "Unnamed row"}
            subtitle={
              choices[index]?.kind === "open"
                ? "Will be posted as an open shift"
                : suggestion
                  ? `Looks like ${suggestion.displayName || suggestion.rosterName || "this person"}`
                  : "Choose what this row means"
            }
            trailing={
              <span className="flex flex-wrap gap-2">
                {suggestion ? (
                  <Button
                    variant="secondary"
                    onClick={() => onChoose(index, { kind: "person", userId: suggestion.userId })}
                  >
                    Use {suggestion.displayName || suggestion.rosterName || "this person"}
                  </Button>
                ) : null}
                <select
                  aria-label={`Pick a person for ${row.rowName.trim() || "unnamed row"}`}
                  defaultValue=""
                  className="min-h-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-sm"
                  onChange={(event) =>
                    event.target.value && onChoose(index, { kind: "person", userId: event.target.value })
                  }
                >
                  <option value="">Pick a person</option>
                  {people.map((person) => (
                    <option key={person.userId} value={person.userId}>
                      {person.displayName || person.rosterName || person.userId}
                    </option>
                  ))}
                </select>
                {row.rowName.trim() ? (
                  <Button variant="secondary" onClick={() => onChoose(index, { kind: "named" })}>
                    Keep as named
                  </Button>
                ) : null}
                {/^\s*(?:tba|open|vacant)?\s*$/i.test(row.rowName) ? (
                  <Button variant="secondary" onClick={() => onChoose(index, { kind: "open" })}>
                    Open shift
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => onInvite(index)}>
                  Invite by email
                </Button>
              </span>
            }
          />
        );
      })}
    </ModeGroupedList>
  );
}
