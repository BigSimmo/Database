import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import type { RosterGrade, RosterPerson } from "@/lib/roster/team/model";

export type StaffingNeed = {
  id?: string;
  /** ISO weekday: Monday 1 through Sunday 7. */
  weekday: number | null;
  date: string | null;
  kind: "day" | "evening" | "night" | "on_call" | "other";
  grade: Exclude<RosterGrade, "other"> | null;
  siteId: string | null;
  needed: number;
};
export type StaffingShift = {
  id: string;
  userId: string | null;
  rosterName?: string | null;
  siteId: string | null;
  startsAt: string;
  endsAt: string;
  kind: string;
  grade: RosterGrade | null;
};
export type StaffingRow = {
  need: StaffingNeed;
  date: string;
  rostered: number;
  named: number;
  gap: number;
  source: "dated" | "recurring";
};

function scopeKey(need: Pick<StaffingNeed, "siteId" | "grade" | "kind">): string {
  return `${need.siteId ?? "∅"}|${need.grade ?? "∅"}|${need.kind}`;
}

/** A dated value, including zero, replaces a recurring value for the identical scope only. */
export function staffingForDate(
  date: string,
  needs: readonly StaffingNeed[],
  shifts: readonly StaffingShift[],
): { rows: StaffingRow[]; error: string | null } {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  if (!Number.isFinite(weekday)) return { rows: [], error: "Invalid staffing date." };
  const selected = new Map<string, { need: StaffingNeed; source: "dated" | "recurring" }>();
  const seen = new Set<string>();
  for (const need of needs) {
    if (need.date !== date && !(need.date === null && need.weekday === weekday)) continue;
    const source = need.date === date ? "dated" : "recurring";
    const key = scopeKey(need);
    const dimension = `${key}|${source}`;
    if (seen.has(dimension)) return { rows: [], error: "Duplicate staffing requirements need review." };
    seen.add(dimension);
    if (source === "dated" || !selected.has(key)) selected.set(key, { need, source });
  }
  const rows = [...selected.values()].map(({ need, source }) => {
    const matching = shifts.filter(
      (shift) =>
        perthDateOf(shift.startsAt) === date &&
        shift.kind === need.kind &&
        shift.grade === need.grade &&
        shift.siteId === need.siteId &&
        (!!shift.userId || !!shift.rosterName?.trim()),
    );
    return {
      need,
      date,
      source,
      rostered: matching.length,
      named: matching.filter((shift) => !shift.userId).length,
      gap: Math.max(0, need.needed - matching.length),
    };
  });
  rows.sort((a, b) => scopeKey(a.need).localeCompare(scopeKey(b.need)));
  return { rows, error: null };
}

export type CoverRules = {
  minBreakHours: number | null;
  maxHours7d: number | null;
  source: string | null;
  reviewedOn: string | null;
};
export type Availability = { userId: string; date: string; kind: "cant" | "prefer_off" };
export type TeamLeave = { userId: string; startsOn: string; endsOn: string; status: string };
export type CoverCandidate = { userId: string; name: string; explanation: string };
export type CoverResult = {
  status: "ready" | "rules_unknown" | "grade_unknown" | "untimed" | "on_call_unknown";
  candidates: CoverCandidate[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
function overlapHours(start: number, end: number, windowStart: number): number {
  return Math.max(0, Math.min(end, windowStart + WEEK_MS) - Math.max(start, windowStart)) / HOUR_MS;
}
function withinHoursRule(shifts: readonly StaffingShift[], proposed: StaffingShift, maxHours7d: number): boolean {
  const intervals = [...shifts, proposed]
    .filter((shift) => shift.kind !== "leave" && shift.kind !== "on_call")
    .map((shift) => [Date.parse(shift.startsAt), Date.parse(shift.endsAt)] as const);
  const points = new Set<number>();
  for (const [start, end] of intervals) {
    points.add(start);
    points.add(end);
    points.add(start - WEEK_MS);
    points.add(end - WEEK_MS);
  }
  for (const point of points) {
    const hours = intervals.reduce((sum, [start, end]) => sum + overlapHours(start, end, point), 0);
    if (hours > maxHours7d + 1e-8) return false;
  }
  return true;
}

function datesTouched(shift: StaffingShift): string[] {
  const first = perthDateOf(shift.startsAt);
  const last = perthDateOf(new Date(Date.parse(shift.endsAt) - 1));
  const dates: string[] = [];
  for (let date = first; date <= last && dates.length < 3; date = addDaysToDate(date, 1)) dates.push(date);
  return dates;
}

/** Suggestions are advisory and use a real timed vacancy; no times are inferred from a requirement. */
export function coverSuggestions(input: {
  vacancy: StaffingShift;
  requiredGrade: RosterGrade | null;
  people: readonly RosterPerson[];
  published: readonly StaffingShift[];
  draft: readonly StaffingShift[];
  availability: readonly Availability[];
  leave: readonly TeamLeave[];
  rules: CoverRules;
}): CoverResult {
  const { vacancy, rules } = input;
  if (
    !Number.isFinite(Date.parse(vacancy.startsAt)) ||
    !Number.isFinite(Date.parse(vacancy.endsAt)) ||
    Date.parse(vacancy.endsAt) <= Date.parse(vacancy.startsAt)
  )
    return { status: "untimed", candidates: [] };
  if (!input.requiredGrade || input.requiredGrade === "other") return { status: "grade_unknown", candidates: [] };
  if (rules.minBreakHours === null || rules.maxHours7d === null || !rules.source || !rules.reviewedOn)
    return { status: "rules_unknown", candidates: [] };
  if (vacancy.kind === "on_call") return { status: "on_call_unknown", candidates: [] };
  const dates = datesTouched(vacancy);
  const start = Date.parse(vacancy.startsAt);
  const end = Date.parse(vacancy.endsAt);
  const explanation = `Exact ${input.requiredGrade} grade; no recorded unavailable date, leave or roster clash; satisfies configured ${rules.minBreakHours}-hour break and ${rules.maxHours7d}-hour seven-day limit.`;
  const candidates = input.people
    .filter((person) => {
      if (person.grade !== input.requiredGrade || (person.rotationEndsOn && person.rotationEndsOn < dates.at(-1)!))
        return false;
      if (input.availability.some((item) => item.userId === person.userId && dates.includes(item.date))) return false;
      if (
        input.leave.some(
          (item) => item.userId === person.userId && item.startsOn <= dates.at(-1)! && item.endsOn >= dates[0]!,
        )
      )
        return false;
      const scheduled = [...input.published, ...input.draft]
        .filter((shift) => shift.userId === person.userId && shift.id !== vacancy.id)
        .filter(
          (shift, index, all) =>
            all.findIndex(
              (other) =>
                other.startsAt === shift.startsAt && other.endsAt === shift.endsAt && other.kind === shift.kind,
            ) === index,
        );
      if (
        scheduled.some(
          (shift) =>
            !Number.isFinite(Date.parse(shift.startsAt)) ||
            !Number.isFinite(Date.parse(shift.endsAt)) ||
            shift.kind === "on_call",
        )
      )
        return false;
      if (scheduled.some((shift) => Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start)) return false;
      if (
        scheduled.some(
          (shift) =>
            shift.kind !== "leave" &&
            ((Date.parse(shift.endsAt) <= start && start - Date.parse(shift.endsAt) < rules.minBreakHours! * HOUR_MS) ||
              (Date.parse(shift.startsAt) >= end && Date.parse(shift.startsAt) - end < rules.minBreakHours! * HOUR_MS)),
        )
      )
        return false;
      const proposed = { ...vacancy, userId: person.userId };
      return withinHoursRule(scheduled, proposed, rules.maxHours7d!);
    })
    .map((person) => ({
      userId: person.userId,
      name: person.rosterName || person.displayName || "Team member",
      explanation,
    }));
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return { status: "ready", candidates };
}
