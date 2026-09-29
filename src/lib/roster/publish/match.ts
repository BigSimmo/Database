import type { RosterPerson } from "@/lib/roster/team/model";

export type RowMatch = { userId: string; how: "roster_name" | "display_name" } | { suggestion: string } | null;

export type MatchedRow = { rowName: string; match: RowMatch };

function key(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-AU")
    .replace(/^(?:dr|doctor)\.?\s+/, "")
    .replace(/\s+/g, " ");
}

/** Exact matches only. A likely name is advice until a manager chooses it. */
export function matchRowsToPeople(rows: readonly string[], people: readonly RosterPerson[]): MatchedRow[] {
  return rows.map((rowName) => {
    const wanted = key(rowName);
    if (!wanted) return { rowName, match: null };
    for (const [field, how] of [
      ["rosterName", "roster_name"],
      ["displayName", "display_name"],
    ] as const) {
      const exact = people.filter((person) => person[field] && key(person[field]!) === wanted);
      if (exact.length === 1) return { rowName, match: { userId: exact[0]!.userId, how } };
      if (exact.length > 1) return { rowName, match: null };
    }
    const words = wanted.split(" ");
    const initial = words[0];
    const surname = words.at(-1);
    if (words.length === 2 && initial?.length === 1 && surname) {
      const suggested = people.filter((person) => {
        const name = key(person.displayName || person.rosterName || "").split(" ");
        return name.length >= 2 && name[0]?.startsWith(initial) && name.at(-1) === surname;
      });
      if (suggested.length === 1) return { rowName, match: { suggestion: suggested[0]!.userId } };
    }
    return { rowName, match: null };
  });
}
