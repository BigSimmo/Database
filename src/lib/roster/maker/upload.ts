import { gridRowToShifts, normaliseCode, type CodeMap, type RosterGrid } from "@/lib/roster/import/grid";
import { matchRowsToPeople } from "@/lib/roster/publish/match";
import { perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import type { RosterDraft, RosterDraftAssignment, RosterDraftOperation } from "./model";
import type { RosterAssignment, RosterChanges, RosterPerson, RosterShiftCode } from "@/lib/roster/team/model";

export type UploadChoice = { kind: "person"; userId: string } | { kind: "named" };
export type UploadDifference = {
  key: string;
  person: string;
  date: string;
  before: string;
  after: string;
  reason: string | null;
  operation: RosterDraftOperation;
};
export type UploadPreview = {
  differences: UploadDifference[];
  errors: string[];
  vacancies: string[];
};

const identity = (row: { userId: string | null; rosterName?: string | null; name?: string | null }) =>
  row.userId ?? `named:${(row.rosterName ?? row.name ?? "").trim().toLocaleLowerCase("en-AU")}`;
const dutyKey = (person: string, date: string) => `${person}|${date}`;
const same = (
  a: Pick<RosterDraftAssignment, "startsAt" | "endsAt" | "shiftCode" | "kind" | "siteId" | "grade">,
  b: typeof a,
) =>
  Date.parse(a.startsAt) === Date.parse(b.startsAt) &&
  Date.parse(a.endsAt) === Date.parse(b.endsAt) &&
  a.shiftCode === b.shiftCode &&
  a.kind === b.kind &&
  a.siteId === b.siteId &&
  a.grade === b.grade;
const display = (row: { shiftCode: string; startsAt: string; endsAt: string } | null) =>
  row ? `${row.shiftCode} (${perthTimeOf(row.startsAt)}–${perthTimeOf(row.endsAt)})` : "No duty";
const vacancySlot = (row: { startsAt: string; endsAt: string; shiftCode: string; kind: string }) =>
  `${Date.parse(row.startsAt)}|${Date.parse(row.endsAt)}|${row.shiftCode}|${row.kind}`;
const vacancyKey = (row: { startsAt: string; endsAt: string; shiftCode: string; kind: string }) =>
  `vacancy|${perthDateOf(row.startsAt)}|${vacancySlot(row)}`;
const vacancyProtectionKey = (row: { startsAt: string; shiftCode: string }) =>
  `vacancy|${perthDateOf(row.startsAt)}|${Date.parse(row.startsAt)}|${row.shiftCode}`;

function historyDuty(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.starts_at !== "string" || !Number.isFinite(Date.parse(row.starts_at))) return null;
  const userId = typeof row.user_id === "string" ? row.user_id : null;
  const name = typeof row.roster_name === "string" ? row.roster_name : null;
  if (!userId && !name) {
    if (typeof row.shift_code !== "string") return null;
    return vacancyProtectionKey({ startsAt: row.starts_at, shiftCode: row.shift_code });
  }
  return dutyKey(identity({ userId, rosterName: name }), perthDateOf(row.starts_at));
}

/** Convert a simple, quoted grid CSV to the same table used by Excel/PDF. */
export function parseUploadCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("This CSV has an unfinished quoted cell.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Pure, conservative reconciliation. Every ambiguous row/code/duty prevents an atomic save. */
export function previewDraftUpload(input: {
  grid: RosterGrid;
  draft: RosterDraft;
  live: readonly RosterAssignment[];
  changes: RosterChanges;
  people: readonly RosterPerson[];
  codes: readonly RosterShiftCode[];
  choices?: Readonly<Record<number, UploadChoice>>;
}): UploadPreview {
  const { grid, draft, live, changes, people, codes, choices = {} } = input;
  const errors: string[] = [],
    vacancies: string[] = [],
    differences: UploadDifference[] = [];
  const matches = matchRowsToPeople(
    grid.rows.map((row) => row.name),
    people,
  );
  const codeMap: Record<string, CodeMap[string]> = {};
  for (const code of codes) {
    if (code.kind === "off") codeMap[normaliseCode(code.code)] = { kind: "off" };
    else if (code.starts && code.ends)
      codeMap[normaliseCode(code.code)] = { kind: code.kind, start: code.starts, end: code.ends };
  }
  const byLiveId = new Map(live.map((row) => [row.id, row]));
  const protectedLive = new Set<string>();
  const claimedSlots = new Set<string>();
  for (const swap of changes.swaps) {
    for (const id of [swap.giveAssignmentId, swap.takeAssignmentId]) {
      const row = id ? byLiveId.get(id) : null;
      if (row)
        for (const userId of [swap.requesterId, swap.counterpartyId])
          protectedLive.add(dutyKey(userId, perthDateOf(row.startsAt)));
    }
  }
  for (const claim of changes.openShifts) {
    const row = claim.assignmentId ? byLiveId.get(claim.assignmentId) : null;
    if (row?.userId && claim.claimedBy === row.userId) {
      protectedLive.add(dutyKey(row.userId, perthDateOf(row.startsAt)));
      claimedSlots.add(vacancySlot(row));
    }
  }
  const changedDraft = new Set<string>();
  for (const change of draft.changes) {
    if (change.undoneAt) continue;
    for (const value of [change.change.before, change.change.after]) {
      const key = historyDuty(value);
      if (key) changedDraft.add(key);
    }
  }
  const covered = new Set<string>();
  const usedNames = new Set<string>();
  const vacancyDates = new Set<string>();
  const desiredVacancies = new Map<
    string,
    { startsAt: string; endsAt: string; shiftCode: string; kind: RosterDraftAssignment["kind"] }[]
  >();
  grid.rows.forEach((row, index) => {
    const name = row.name.trim();
    const vacancy = !name || /^TBA$/i.test(name);
    const match = matches[index]?.match;
    const choice = choices[index];
    const userId =
      choice?.kind === "person" ? choice.userId : !choice && match && "userId" in match ? match.userId : null;
    const named = choice?.kind === "named" ? name : null;
    if (!vacancy && !userId && !named) errors.push(`Choose who row ${index + 1} (${name}) belongs to.`);
    if (named && !name) errors.push(`Row ${index + 1} needs a name.`);
    const person = userId ? people.find((item) => item.userId === userId) : null;
    if (userId && !person) errors.push(`Row ${index + 1} selects someone outside this team.`);
    const personKey = userId ?? (named ? identity({ userId: null, rosterName: named }) : "");
    if (personKey && usedNames.has(personKey)) errors.push(`${name} appears in more than one row.`);
    if (personKey) usedNames.add(personKey);
    grid.dates.forEach((date, column) => {
      if (!date || date < draft.draft.periodStart || date > draft.draft.periodEnd) return;
      const cell = row.cells[column] ?? "";
      const parsed = gridRowToShifts({ dates: [date], rows: [{ name, cells: [cell] }] }, 0, codeMap);
      if (parsed.unknown.length) errors.push(`${name || "TBA"} · ${date}: unknown code ${parsed.unknown[0]!.code}.`);
      if (vacancy) {
        vacancyDates.add(date);
        for (const shift of parsed.shifts) {
          const item = {
            startsAt: shift.startsAt,
            endsAt: shift.endsAt,
            shiftCode: normaliseCode(cell),
            kind: shift.kind,
          };
          desiredVacancies.set(date, [...(desiredVacancies.get(date) ?? []), item]);
          vacancies.push(`${date} · ${item.shiftCode} is an unfilled draft shift; no person is assigned.`);
        }
        return;
      }
      if (!personKey) return;
      const key = dutyKey(personKey, date);
      if (covered.has(key)) {
        errors.push(`${name} · ${date} appears twice.`);
        return;
      }
      covered.add(key);
      const current = draft.assignments.filter(
        (item) => identity(item) === personKey && perthDateOf(item.startsAt) === date,
      );
      if (current.length > 1 || parsed.shifts.length > 1) {
        errors.push(`${name} · ${date} has multiple duties; edit it in the draft.`);
        return;
      }
      const before = current[0] ?? null;
      const shift = parsed.shifts[0] ?? null;
      if (!before && !shift) return;
      const comparableLive = live.filter((item) => identity(item) === personKey && perthDateOf(item.startsAt) === date);
      const siteId = before?.siteId ?? (comparableLive.length === 1 ? comparableLive[0]!.siteId : null);
      const after = shift
        ? {
            userId,
            rosterName: userId ? null : named,
            siteId,
            startsAt: shift.startsAt,
            endsAt: shift.endsAt,
            shiftCode: normaliseCode(cell),
            kind: shift.kind,
            grade: before?.grade ?? person?.grade ?? null,
          }
        : null;
      if (before && after && same(before, after)) return;
      const operation: RosterDraftOperation = before
        ? after
          ? { op: "update", id: before.id, row: after }
          : { op: "remove", id: before.id }
        : { op: "add", row: after! };
      const reason = changedDraft.has(key)
        ? "This duty was edited in the draft."
        : protectedLive.has(key)
          ? "An approved live swap or claimed shift affects this duty."
          : null;
      differences.push({
        key,
        person: person?.displayName ?? named ?? name,
        date,
        before: display(before),
        after: display(after),
        reason,
        operation,
      });
    });
  });
  // Vacancy rows have no person identity. Match them as a multiset of actual
  // shift slots so two identical TBA rows remain two distinct assignments.
  for (const date of vacancyDates) {
    const existing = draft.assignments.filter(
      (item) => item.userId === null && item.rosterName === null && perthDateOf(item.startsAt) === date,
    );
    const remaining = [...existing];
    const desired = desiredVacancies.get(date) ?? [];
    const desiredCount = new Map<string, number>();
    for (const item of desired) desiredCount.set(vacancySlot(item), (desiredCount.get(vacancySlot(item)) ?? 0) + 1);
    for (const item of desired) {
      const slot = vacancySlot(item);
      const match = remaining.findIndex((candidate) => vacancySlot(candidate) === slot);
      if (match >= 0) {
        remaining.splice(match, 1);
        continue;
      }
      const matchingLiveClaim = claimedSlots.has(slot);
      const ordinal = desiredCount.get(slot)!;
      desiredCount.set(slot, ordinal - 1);
      const key = `${vacancyKey(item)}|add|${ordinal}`;
      const operation: RosterDraftOperation = {
        op: "add",
        row: {
          userId: null,
          rosterName: null,
          siteId: null,
          grade: null,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          shiftCode: item.shiftCode,
          kind: item.kind,
        },
      };
      const reason = changedDraft.has(vacancyProtectionKey(item))
        ? "This unfilled shift was edited in the draft."
        : matchingLiveClaim
          ? "This shift was already claimed in the live roster."
          : null;
      differences.push({
        key,
        person: "Unfilled (TBA)",
        date,
        before: "No vacancy",
        after: display(item),
        reason,
        operation,
      });
    }
    for (const before of remaining) {
      const identical = existing.filter((item) => vacancySlot(item) === vacancySlot(before));
      if (identical.length > 1 && new Set(identical.map((item) => item.siteId)).size > 1) {
        errors.push(
          `Unfilled shift · ${date} has different sites under the same code and time; edit those vacancies in the draft.`,
        );
        continue;
      }
      const key = `${vacancyKey(before)}|remove|${before.id}`;
      differences.push({
        key,
        person: "Unfilled (TBA)",
        date,
        before: display(before),
        after: "No vacancy",
        reason: changedDraft.has(vacancyProtectionKey(before)) ? "This unfilled shift was edited in the draft." : null,
        operation: { op: "remove", id: before.id },
      });
    }
  }
  if (differences.length > 500)
    errors.push("This upload needs more than 500 changes. Use a shorter period; nothing has been saved.");
  const projected =
    draft.assignments.length +
    differences.filter((item) => item.operation.op === "add").length -
    differences.filter((item) => item.operation.op === "remove").length;
  if (projected > 5000) errors.push("The draft would exceed 5,000 assignments.");
  return { differences, errors, vacancies };
}
