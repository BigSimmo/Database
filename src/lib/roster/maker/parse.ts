import { addDaysToDate, perthDateOf, perthWallToIso } from "@/lib/roster/shifts/perth-time";

/** One deliberately narrow, local-only typed change. The text never enters the result. */
export const ROSTER_MAKER_CHANGE_SYNTAX = "Set <exact roster name> on YYYY-MM-DD to <exact shift code>";

export type RosterMakerPerson = {
  userId: string;
  name: string;
  grade?: string | null;
};

export type RosterMakerCode = {
  code: string;
  kind: string;
  starts: string | null;
  ends: string | null;
};

export type RosterMakerAssignment = {
  id: string;
  userId: string | null;
  startsAt: string;
  endsAt: string;
  shiftCode?: string;
  kind?: string;
  siteId?: string | null;
};

export type RosterMakerParseContext = {
  people: readonly RosterMakerPerson[];
  codes: readonly RosterMakerCode[];
  assignments: readonly RosterMakerAssignment[];
  periodStart: string;
  periodEnd: string;
};

export type RosterMakerShiftKind = "day" | "evening" | "night" | "on_call" | "leave" | "other";
export type RosterMakerGrade = "intern" | "resident" | "registrar" | "fellow" | "consultant" | "other";

export type RosterMakerProposedRow = {
  userId: string;
  rosterName: string;
  siteId: string | null;
  startsAt: string;
  endsAt: string;
  shiftCode: string;
  kind: RosterMakerShiftKind;
  grade: RosterMakerGrade | null;
};

export type RosterMakerOperation =
  | { op: "add"; row: RosterMakerProposedRow }
  | { op: "update"; id: string; row: RosterMakerProposedRow }
  | { op: "remove"; id: string };

export type RosterMakerShiftSummary = {
  shiftCode: string;
  kind: string;
  startsAt: string;
  endsAt: string;
};

export type RosterMakerParseResult =
  | { status: "refused"; message: string }
  | {
      status: "ready";
      person: RosterMakerPerson;
      date: string;
      before: RosterMakerShiftSummary | null;
      after: RosterMakerShiftSummary | null;
      operation: RosterMakerOperation;
    };

const VALID_KINDS = new Set(["day", "evening", "night", "on_call", "leave", "other"]);
const VALID_GRADES = new Set(["intern", "resident", "registrar", "fellow", "consultant", "other"]);

function refused(message: string): RosterMakerParseResult {
  return { status: "refused", message };
}

function exactMatch(value: string, candidate: string): boolean {
  return value.toLocaleLowerCase("en-AU") === candidate.trim().toLocaleLowerCase("en-AU");
}

/** Returns a proposed operation only. The caller must show it and obtain Apply. */
export function parseRosterMakerChange(text: string, context: RosterMakerParseContext): RosterMakerParseResult {
  if (text.length > 256 || /[;\r\n]/.test(text) || /\b(?:not|never|except|unless|but|instead|and|or)\b/i.test(text)) {
    return refused(`Use one unqualified change: ${ROSTER_MAKER_CHANGE_SYNTAX}`);
  }

  const command = /^Set (.+?) on (\d{4}-\d{2}-\d{2}) to (.+)$/i.exec(text.trim());
  if (!command) return refused(`Use: ${ROSTER_MAKER_CHANGE_SYNTAX}`);
  const name = command[1]!.trim();
  const date = command[2]!;
  const codeText = command[3]!.trim();
  if (!name || !codeText) return refused(`Use: ${ROSTER_MAKER_CHANGE_SYNTAX}`);

  if (
    !perthWallToIso(date, "00:00") ||
    !perthWallToIso(context.periodStart, "00:00") ||
    !perthWallToIso(context.periodEnd, "00:00") ||
    context.periodStart > context.periodEnd ||
    date < context.periodStart ||
    date > context.periodEnd
  ) {
    return refused("Choose a valid date in this draft period.");
  }

  const people = context.people.filter((person) => exactMatch(name, person.name));
  if (people.length !== 1) return refused("Choose one exact roster name from the team list.");
  const person = people[0]!;
  if (person.grade != null && !VALID_GRADES.has(person.grade)) {
    return refused("This person's grade needs manual review.");
  }

  const codes = context.codes.filter((code) => exactMatch(codeText, code.code));
  if (codes.length !== 1) return refused("Choose one exact shift code from the team list.");
  const code = codes[0]!;

  // A malformed assigned duty could hide a date collision; refuse rather than add beside it.
  const personAssignments = context.assignments.filter((assignment) => assignment.userId === person.userId);
  if (
    personAssignments.some(
      (assignment) =>
        !Number.isFinite(Date.parse(assignment.startsAt)) ||
        !Number.isFinite(Date.parse(assignment.endsAt)) ||
        Date.parse(assignment.endsAt) <= Date.parse(assignment.startsAt),
    )
  ) {
    return refused("This person's duties need manual review.");
  }
  const duties = personAssignments.filter((assignment) => perthDateOf(assignment.startsAt) === date);
  if (duties.length > 1) return refused("More than one duty matches this person and date. Edit the cell manually.");
  const current = duties[0] ?? null;
  if (current && (!current.shiftCode || !current.kind)) {
    return refused("This duty needs manual review.");
  }
  const before: RosterMakerShiftSummary | null = current
    ? {
        shiftCode: current.shiftCode!,
        kind: current.kind!,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
      }
    : null;

  if (code.kind === "off") {
    if (code.starts !== null || code.ends !== null) return refused("This shift code needs manual review.");
    if (!current) return refused("No duty exists to remove on this date.");
    return {
      status: "ready",
      person,
      date,
      before,
      after: null,
      operation: { op: "remove", id: current.id },
    };
  }

  if (!VALID_KINDS.has(code.kind) || !code.starts || !code.ends || code.starts === code.ends) {
    return refused("This shift code needs a valid start and end time.");
  }
  const startsAt = perthWallToIso(date, code.starts);
  const endDate = code.ends < code.starts ? addDaysToDate(date, 1) : date;
  const endsAt = perthWallToIso(endDate, code.ends);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return refused("This shift code needs a valid start and end time.");
  }
  const after: RosterMakerShiftSummary = { shiftCode: code.code, kind: code.kind, startsAt, endsAt };
  if (
    before &&
    before.shiftCode === after.shiftCode &&
    before.kind === after.kind &&
    Date.parse(before.startsAt) === Date.parse(after.startsAt) &&
    Date.parse(before.endsAt) === Date.parse(after.endsAt)
  ) {
    return refused("This duty already has that shift.");
  }
  if (current && current.siteId === undefined) {
    return refused("This duty needs manual review before changing its site.");
  }

  const row: RosterMakerProposedRow = {
    userId: person.userId,
    rosterName: person.name,
    siteId: current?.siteId ?? null,
    startsAt,
    endsAt,
    shiftCode: code.code,
    kind: code.kind as RosterMakerShiftKind,
    grade: (person.grade ?? null) as RosterMakerGrade | null,
  };
  return {
    status: "ready",
    person,
    date,
    before,
    after,
    operation: current ? { op: "update", id: current.id, row } : { op: "add", row },
  };
}
