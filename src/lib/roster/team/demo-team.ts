import { rosterInvalidRequest } from "@/lib/roster/team/errors";
import type {
  RosterAssignment,
  RosterGrade,
  RosterReadResult,
  RosterReadWhat,
  RosterTeam,
} from "@/lib/roster/team/model";
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

function demoAssignments(now: Date): RosterAssignment[] {
  const start = periodStart(now);
  const rows: RosterAssignment[] = [];
  for (let day = 0; day < 28; day += 1) {
    const date = addDaysToDate(start, day);
    PEOPLE.forEach((person, index) => {
      // Each person works five days in seven, rotating through day, evening and night.
      if ((day + index) % 7 >= 5) return;
      const shift = PATTERN[(Math.floor(day / 7) + index) % PATTERN.length];
      rows.push({
        id: hexId(0x1000 + day * 16 + index),
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
