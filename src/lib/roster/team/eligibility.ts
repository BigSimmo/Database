import type { RosterAssignment, RosterGrade, RosterSettings, SwapNeedsManagerReason } from "@/lib/roster/team/model";

/**
 * Who can take a shift, and whether a swap needs the manager, worked out on
 * the phone so a doctor sees the answer before sending. This is advice only:
 * `swap.create`, `swap.accept`, `swap.approve`, `open.claim` and
 * `open.approve` recheck all of it in SQL. Each function mirrors its SQL twin
 * in supabase/migrations/20260926225409_roster_mode.sql
 * (`roster_grade_rank`, `roster_placement_problem`, and the swap/open-shift
 * branches of `roster_command`), in the SQL's order.
 *
 * Only the team roster is read: a colleague's other job or own shifts never
 * are. `assignments` must be the team's live rows.
 */

const HOUR_MS = 3_600_000;
const SEVEN_DAYS_MS = 7 * 24 * HOUR_MS;

type Shift = Pick<RosterAssignment, "id" | "userId" | "startsAt" | "endsAt" | "kind">;

/** intern 1 … consultant 5. `other` and a missing grade never match. */
export function gradeRank(grade: RosterGrade | string | null | undefined): number | null {
  switch (grade) {
    case "intern":
      return 1;
    case "resident":
      return 2;
    case "registrar":
      return 3;
    case "fellow":
      return 4;
    case "consultant":
      return 5;
    default:
      return null;
  }
}

function ms(value: string): number {
  return Date.parse(value);
}

/**
 * Would putting `userId` on [startsAt, endsAt) clash with their other live
 * shifts, or leave a break shorter than `minBreakHours`? Leave always counts
 * as a clash; on-call and leave are ignored for breaks.
 */
export function placementProblem(
  assignments: readonly Shift[],
  userId: string,
  startsAt: string,
  endsAt: string,
  excludeIds: readonly (string | null | undefined)[],
  minBreakHours: number | null | undefined,
): null | "clash" | "short_break" {
  const start = ms(startsAt);
  const end = ms(endsAt);
  const excluded = new Set(excludeIds.filter(Boolean));
  const theirs = assignments.filter((a) => a.userId === userId);
  const clash = theirs.some(
    (a) => (a.kind === "leave" || !excluded.has(a.id)) && ms(a.startsAt) < end && ms(a.endsAt) > start,
  );
  if (clash) return "clash";
  if (minBreakHours === null || minBreakHours === undefined) return null;
  const minBreak = minBreakHours * HOUR_MS;
  const short = theirs.some((a) => {
    if (a.kind === "leave" || a.kind === "on_call" || excluded.has(a.id)) return false;
    const aStart = ms(a.startsAt);
    const aEnd = ms(a.endsAt);
    return (aEnd <= start && start - aEnd < minBreak) || (aStart >= end && aStart - end < minBreak);
  });
  return short ? "short_break" : null;
}

function breakShifts(assignments: readonly Shift[], userId: string): Shift[] {
  return assignments.filter((a) => a.userId === userId && a.kind !== "leave" && a.kind !== "on_call");
}

/** Hours since `userId`'s last worked shift ended at or before `at`; null when there is none. */
export function hoursSinceLastShift(assignments: readonly Shift[], userId: string, at: string): number | null {
  const atMs = ms(at);
  const ends = breakShifts(assignments, userId)
    .map((a) => ms(a.endsAt))
    .filter((end) => end <= atMs);
  if (!ends.length) return null;
  return Math.floor((atMs - Math.max(...ends)) / HOUR_MS);
}

/** Hours from `at` until `userId`'s next worked shift starts; null when there is none. */
export function hoursUntilNextShift(assignments: readonly Shift[], userId: string, at: string): number | null {
  const atMs = ms(at);
  const starts = breakShifts(assignments, userId)
    .map((a) => ms(a.startsAt))
    .filter((start) => start >= atMs);
  if (!starts.length) return null;
  return Math.floor((Math.min(...starts) - atMs) / HOUR_MS);
}

export type SwapCheck = {
  readonly give: Shift;
  readonly take?: Shift | null;
  /** The requester's grade for the given shift: the shift's own grade, else theirs. */
  readonly giverGrade: RosterGrade | null;
  readonly takerGrade: RosterGrade | null;
  readonly counterpartyId: string;
  readonly settings: Pick<RosterSettings, "swapApproval" | "rules">;
  readonly assignments: readonly Shift[];
  readonly now: Date;
};

/**
 * Why a swap would wait for the manager, in the SQL's order (team setting,
 * then within 7 days, then grade, then team rule), or null when it would
 * approve itself.
 */
export function swapNeedsManager(check: SwapCheck): SwapNeedsManagerReason | null {
  const { give, take, settings, assignments } = check;
  if (settings.swapApproval === "manager") return "team_setting";
  const earliest = Math.min(ms(give.startsAt), take ? ms(take.startsAt) : ms(give.startsAt));
  if (earliest < check.now.getTime() + SEVEN_DAYS_MS) return "within_7_days";
  if (gradeRank(check.takerGrade) !== gradeRank(check.giverGrade)) return "different_grade";
  const minBreak = settings.rules.minBreakHours ?? null;
  if (placementProblem(assignments, check.counterpartyId, give.startsAt, give.endsAt, [take?.id], minBreak)) {
    return "team_rule";
  }
  if (
    take &&
    give.userId &&
    placementProblem(assignments, give.userId, take.startsAt, take.endsAt, [give.id], minBreak)
  ) {
    return "team_rule";
  }
  return null;
}

export type RosterCandidate = {
  readonly userId: string;
  readonly name: string | null;
  readonly grade: RosterGrade;
  /** Same grade as the shift needs: listed first. */
  readonly sameGrade: boolean;
  readonly hoursSinceLastShift: number | null;
  /** True when the team's break rule would send it to the manager. */
  readonly shortBreak: boolean;
};

type Person = { userId: string; name: string | null; grade: RosterGrade | null };

/** Everyone with a live shift in the window, with the latest grade and name seen for them. */
function peopleIn(assignments: readonly RosterAssignment[]): Person[] {
  const people = new Map<string, Person>();
  for (const a of assignments) {
    if (!a.userId) continue;
    const known = people.get(a.userId);
    people.set(a.userId, {
      userId: a.userId,
      name: a.name ?? known?.name ?? null,
      grade: a.grade ?? known?.grade ?? null,
    });
  }
  return [...people.values()];
}

/**
 * The colleagues to weigh for a shift. With the team's current members (the
 * `members` read), that list is the population: someone with no shift in the
 * rows read is still a colleague, and someone who has left is not one even if
 * old rows remain. A member's name or grade, when missing, falls back to what
 * the rows show. Without members, the people in the rows are the population.
 */
export function teamPeople(
  assignments: readonly RosterAssignment[],
  members?: readonly { userId: string; name: string | null; grade: RosterGrade | null }[],
): Person[] {
  const fromRows = peopleIn(assignments);
  if (!members) return fromRows;
  const seen = new Map(fromRows.map((person) => [person.userId, person]));
  return members.map((member) => ({
    userId: member.userId,
    name: member.name ?? seen.get(member.userId)?.name ?? null,
    grade: member.grade ?? seen.get(member.userId)?.grade ?? null,
  }));
}

function byFit(a: RosterCandidate, b: RosterCandidate): number {
  if (a.sameGrade !== b.sameGrade) return a.sameGrade ? -1 : 1;
  const aBreak = a.hoursSinceLastShift ?? Number.POSITIVE_INFINITY;
  const bBreak = b.hoursSinceLastShift ?? Number.POSITIVE_INFINITY;
  if (aBreak !== bBreak) return bBreak - aBreak;
  return (a.name ?? "").localeCompare(b.name ?? "");
}

/**
 * Colleagues who could take `give` from `me`: seen in the team window, a
 * grade at or above the giver's, and free. Same grade first, then the longest
 * break before the shift.
 */
export function swapCandidates(
  assignments: readonly RosterAssignment[],
  give: RosterAssignment,
  me: { userId: string; grade: RosterGrade | null },
  settings: Pick<RosterSettings, "rules">,
  members?: Parameters<typeof teamPeople>[1],
): RosterCandidate[] {
  const giverRank = gradeRank(give.grade ?? me.grade);
  if (giverRank === null) return [];
  const minBreak = settings.rules.minBreakHours ?? null;
  return teamPeople(assignments, members)
    .filter((person) => person.userId !== me.userId)
    .flatMap((person): RosterCandidate[] => {
      const rank = gradeRank(person.grade);
      if (rank === null || rank < giverRank) return [];
      if (placementProblem(assignments, person.userId, give.startsAt, give.endsAt, [], null)) return [];
      return [
        {
          userId: person.userId,
          name: person.name,
          grade: person.grade!,
          sameGrade: rank === giverRank,
          hoursSinceLastShift: hoursSinceLastShift(assignments, person.userId, give.startsAt),
          shortBreak: placementProblem(assignments, person.userId, give.startsAt, give.endsAt, [], minBreak) !== null,
        },
      ];
    })
    .sort(byFit);
}

export type OpenShiftLike = {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly minGrade: RosterGrade | null;
  readonly assignmentId?: string | null;
};

/**
 * Who could take an open shift: a grade (never missing, never `other`) at or
 * above its minimum, and free. `excludeUserId` is the poster, who never takes
 * their own shift back.
 */
export function openShiftCandidates(
  assignments: readonly RosterAssignment[],
  open: OpenShiftLike,
  settings: Pick<RosterSettings, "rules">,
  excludeUserId: string | null,
): RosterCandidate[] {
  const minRank = gradeRank(open.minGrade);
  const minBreak = settings.rules.minBreakHours ?? null;
  const holder = open.assignmentId ? assignments.find((a) => a.id === open.assignmentId)?.userId : null;
  return peopleIn(assignments)
    .filter((person) => person.userId !== excludeUserId && person.userId !== holder)
    .flatMap((person): RosterCandidate[] => {
      const rank = gradeRank(person.grade);
      if (rank === null || (minRank !== null && rank < minRank)) return [];
      if (placementProblem(assignments, person.userId, open.startsAt, open.endsAt, [open.assignmentId], null)) {
        return [];
      }
      return [
        {
          userId: person.userId,
          name: person.name,
          grade: person.grade!,
          sameGrade: minRank !== null && rank === minRank,
          hoursSinceLastShift: hoursSinceLastShift(assignments, person.userId, open.startsAt),
          shortBreak:
            placementProblem(assignments, person.userId, open.startsAt, open.endsAt, [open.assignmentId], minBreak) !==
            null,
        },
      ];
    })
    .sort(byFit);
}
