import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import type {
  RosterAction,
  RosterAssignment,
  RosterCommandResult,
  RosterGrade,
  RosterReadResult,
  RosterReadWhat,
  RosterTeam,
} from "@/lib/roster/team/model";
import { SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";
import type { OnCallShift } from "@/lib/roster/shifts/model";
import { addDaysToDate, perthDateOf, perthWallToIso } from "@/lib/roster/shifts/perth-time";

/**
 * One invented team for synthetic demo mode, so offline browser checks have
 * something to draw. Every name, place and id is made up. The reader is
 * "Dr Alex Example", a registrar and the team's roster manager. Dates are
 * worked out from `now`, so the demo always has a current and a next fortnight.
 */

export const DEMO_SERVICE_ID = "d0000000-0000-4000-8000-000000000001";
const DEMO_SITE_ID = "d0000000-0000-4000-8000-000000000002";
const DEMO_PUBLICATION_ID = "d0000000-0000-4000-8000-000000000003";
const DEMO_SWAP_ID = "d0000000-0000-4000-8000-000000000004";
const DEMO_OPEN_SHIFT_ID = "d0000000-0000-4000-8000-000000000005";
export const DEMO_ME_ID = "d0000000-0000-4000-8000-0000000000a1";

const PEOPLE: readonly { userId: string; name: string; grade: RosterGrade; manager?: boolean }[] = [
  { userId: DEMO_ME_ID, name: "Dr Alex Example", grade: "registrar", manager: true },
  { userId: "d0000000-0000-4000-8000-0000000000a2", name: "Dr Sam Example", grade: "registrar" },
  { userId: "d0000000-0000-4000-8000-0000000000a3", name: "Dr Mei Example", grade: "resident" },
  { userId: "d0000000-0000-4000-8000-0000000000a4", name: "Dr Noor Example", grade: "resident" },
  { userId: "d0000000-0000-4000-8000-0000000000a5", name: "Dr Kai Example", grade: "intern" },
  { userId: "d0000000-0000-4000-8000-0000000000a6", name: "Dr Jordan Example", grade: "consultant" },
  { userId: "d0000000-0000-4000-8000-0000000000a7", name: "Dr Lee Example", grade: "intern" },
];

const PATTERN = [
  { code: "D", kind: "day", start: "08:00", end: "16:30", overnight: false },
  { code: "E", kind: "evening", start: "14:00", end: "22:30", overnight: false },
  { code: "N", kind: "night", start: "21:30", end: "08:00", overnight: true },
] as const;

function periodStart(now: Date): string {
  const today = perthDateOf(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  // The fortnight starts on the Monday of this week.
  return addDaysToDate(today, -((weekday + 6) % 7));
}

function hexId(n: number): string {
  return `d0000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

/** Days before and after the current Monday that the sample roster covers. */
const DEMO_DAYS_BEFORE = 21;
const DEMO_DAYS_AFTER = 42;

function demoAssignments(now: Date): RosterAssignment[] {
  const start = periodStart(now);
  const rows: RosterAssignment[] = [];
  for (let day = -DEMO_DAYS_BEFORE; day < DEMO_DAYS_AFTER; day += 1) {
    const date = addDaysToDate(start, day);
    PEOPLE.forEach((person, index) => {
      // Each person works five days in seven, rotating through day, evening and night.
      if ((((day + index) % 7) + 7) % 7 >= 5) return;
      const shift = PATTERN[(((Math.floor(day / 7) + index) % PATTERN.length) + PATTERN.length) % PATTERN.length];
      rows.push({
        id: hexId(0x1000 + (day + DEMO_DAYS_BEFORE) * 16 + index),
        userId: person.userId,
        name: person.name,
        grade: person.grade,
        siteId: DEMO_SITE_ID,
        siteName: "Example Hospital",
        startsAt: perthWallToIso(date, shift.start)!,
        endsAt: perthWallToIso(shift.overnight ? addDaysToDate(date, 1) : date, shift.end)!,
        shiftCode: shift.code,
        kind: shift.kind,
      });
    });
  }
  return rows;
}

export function demoRosterTeams(): RosterTeam[] {
  return [
    {
      serviceId: DEMO_SERVICE_ID,
      name: "Example Health Service · General Medicine",
      enabled: true,
      role: "manager",
      grade: "registrar",
    },
  ];
}

export function demoRosterRead<W extends RosterReadWhat>(
  what: W,
  range: { from?: string; to?: string },
  now = new Date(),
): RosterReadResult<W> {
  const start = periodStart(now);
  const assignments = demoAssignments(now);
  const future = assignments.filter((a) => Date.parse(a.startsAt) > now.getTime() + 8 * 86_400_000);
  const mine = future.find((a) => a.userId === DEMO_ME_ID)!;
  const theirs =
    future.find((a) => a.userId === PEOPLE[1].userId && a.kind === mine.kind) ??
    future.find((a) => a.userId === PEOPLE[1].userId) ??
    null;
  const publishedAt = perthWallToIso(addDaysToDate(start, -5), "16:10")!;
  const swap = {
    id: DEMO_SWAP_ID,
    status: "requested" as const,
    autoApproved: false,
    needsManagerBecause: null,
    cancelReason: null,
    requesterId: PEOPLE[1].userId,
    counterpartyId: DEMO_ME_ID,
    give: theirs,
    take: mine,
    expiresAt: mine.startsAt,
    createdAt: new Date(now.getTime() - 3_600_000).toISOString(),
    decidedAt: null,
  };
  const openDay = addDaysToDate(start, 12);
  const openShift = {
    id: DEMO_OPEN_SHIFT_ID,
    status: "open" as const,
    urgent: false,
    startsAt: perthWallToIso(openDay, "14:00")!,
    endsAt: perthWallToIso(openDay, "22:30")!,
    shiftCode: "E",
    kind: "evening" as const,
    minGrade: "resident" as const,
    siteId: DEMO_SITE_ID,
  };
  const answers: Record<RosterReadWhat, () => unknown> = {
    overview: () => ({
      service: { id: DEMO_SERVICE_ID, name: "General Medicine" },
      me: { role: "manager", grade: "registrar", rotationEndsOn: addDaysToDate(start, 69) },
      latestPublication: {
        id: DEMO_PUBLICATION_ID,
        version: 1,
        publishedAt,
        periodStart: start,
        periodEnd: addDaysToDate(start, 27),
      },
      seenLatest: true,
      settings: {
        swapApproval: "auto_same_grade",
        rules: { minBreakHours: 10 },
        rulesSource: null,
        payFortnightAnchor: start,
      },
      sites: [{ id: DEMO_SITE_ID, name: "Example Hospital" }],
    }),
    assignments: () => ({
      assignments: assignments.filter((a) => {
        const date = perthDateOf(a.startsAt);
        return (!range.from || date >= range.from) && (!range.to || date <= range.to);
      }),
    }),
    requests: () => ({ swaps: [swap], openShifts: [{ ...openShift, mine: false, claimedByMe: false }] }),
    unavailability: () => ({ unavailability: [] }),
    leave_overlap: () => ({ alreadyOff: 0 }),
    manage: () => ({
      swaps: [],
      openShifts: [{ ...openShift, postedBy: PEOPLE[3].userId, claimedBy: null, claimedAt: null }],
      seen: {
        publicationId: DEMO_PUBLICATION_ID,
        version: 1,
        seen: 5,
        members: PEOPLE.length,
        notSeen: [PEOPLE[4].userId, PEOPLE[6].userId],
      },
    }),
    people: () => ({
      people: PEOPLE.map((person) => ({
        userId: person.userId,
        displayName: person.name,
        joinedAt: publishedAt,
        serviceRole: "member",
        role: person.manager ? "manager" : "member",
        grade: person.grade,
        rosterName: null,
        rotationEndsOn: null,
      })),
    }),
    publications: () => ({
      publications: [
        {
          id: DEMO_PUBLICATION_ID,
          version: 1,
          kind: "full",
          periodStart: start,
          periodEnd: addDaysToDate(start, 27),
          sourceName: "example-roster.xlsx",
          publishedAt,
        },
      ],
    }),
    maker: () => ({
      codes: PATTERN.map((shift) => ({
        code: shift.code,
        kind: shift.kind,
        starts: shift.start,
        ends: shift.end,
        label: null,
      })),
      needs: [],
      drafts: [],
    }),
    changes: () => {
      throw rosterInvalidRequest();
    },
    team_leave: () => {
      throw rosterInvalidRequest();
    },
    my_changes: () => {
      throw rosterInvalidRequest();
    },
  };
  return answers[what]() as RosterReadResult<W>;
}

/**
 * The sample reader's own shifts (Dr Alex Example's), as a personal roster, so
 * Today and Shifts have a full example. Same shifts as the sample team shows.
 */
export function demoMyShifts(now = new Date()): OnCallShift[] {
  return demoAssignments(now)
    .filter((row) => row.userId === DEMO_ME_ID)
    .map((row) => ({
      id: `sample-${row.id}`,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      title: `${SHIFT_KIND_LABEL[row.kind as ShiftKind] ?? row.shiftCode} shift`,
      location: row.siteName,
      sourceUid: null,
      kind: row.kind as ShiftKind,
      source: "import" as const,
      seriesId: null,
      workplace: row.siteName,
    }));
}

/** The sample reader's own leave: one week of approved annual leave next month. */
export function demoRosterLeave(now = new Date()) {
  const start = addDaysToDate(periodStart(now), 35);
  return [
    {
      id: "d0000000-0000-4000-8000-000000000006",
      kind: "annual" as const,
      startsOn: start,
      endsOn: addDaysToDate(start, 4),
      status: "approved" as const,
      serviceId: DEMO_SERVICE_ID,
    },
  ];
}

/** The sample team's publish preview for a period: its current shifts, people and codes. */
export function demoPublishPreview(from: string, to: string, now = new Date()) {
  return {
    freshnessToken: "sample",
    assignments: demoRosterRead("assignments", { from, to }, now).assignments,
    changes: { swaps: [], openShifts: [] },
    people: demoRosterRead("people", {}, now).people,
    codes: demoRosterRead("maker", {}, now).codes,
  };
}

/** An example publish receipt. Nothing is published and nobody is told. */
export function demoPublishReceipt() {
  return {
    publicationId: crypto.randomUUID(),
    version: 2,
    swapsCancelled: [],
    changedUserIds: [],
    openShiftIds: [],
    overridesRecorded: [],
  };
}

/**
 * The sample team's answer to a team action while the real-staff release is
 * held: the receipt a real team would give, so the screen carries on (a swap
 * shows as sent, a give-away as posted). Nothing is saved, and the next read
 * shows the sample team unchanged.
 */
export function demoRosterCommand(action: RosterAction): RosterCommandResult {
  const id = crypto.randomUUID();
  switch (action.action) {
    case "swap.create":
      return { ok: true, swapId: id, status: "requested", autoApproved: false };
    case "swap.accept":
      return { ok: true, swapId: action.swapId, status: "approved", autoApproved: true };
    case "swap.approve":
      return { ok: true, swapId: action.swapId, status: "approved" };
    case "swap.decline":
      return { ok: true, swapId: action.swapId, status: "declined" };
    case "swap.cancel":
    case "swap.undo":
      return { ok: true, swapId: action.swapId, status: "cancelled" };
    case "open.post":
      return { ok: true, openShiftId: id, status: "open" };
    case "open.claim":
      return { ok: true, openShiftId: action.openShiftId, status: "claimed" };
    case "open.approve":
      return { ok: true, openShiftId: action.openShiftId, status: "filled" };
    case "open.decline":
    case "open.release":
      return { ok: true, openShiftId: action.openShiftId, status: "open" };
    case "open.cancel":
      return { ok: true, openShiftId: action.openShiftId, status: "cancelled" };
    default:
      return { ok: true };
  }
}
