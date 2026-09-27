import { addDays } from "@/lib/calendar/calendar-event";
import { nextTeachingOccurrence, type RecurringSessionFrequency } from "@/lib/dates/recurring-session";
import type {
  LogbookRow,
  Notice,
  SeriesAudience,
  SessionDetail,
  SessionSummary,
  TeachingWeek,
  TeamSummary,
  WhatsOnRow,
} from "@/lib/teaching/model";
import { perthInstant, perthToday } from "@/lib/teaching/time";

/**
 * The demo service's programme: the seven On Call demo education entries
 * (`src/lib/on-call/demo-entries.ts`, ids 50 to 56) as Teaching series.
 *
 * Everything here must stay obviously made up: every title and room starts "Demo",
 * the only presenter is "Demo presenter", and every link is example.org. Shown in
 * demo mode and to signed-out visitors, never mixed with a real team.
 *
 * Recurring series hang off fixed 2026 anchors, so a week view is a real timetable
 * and a session keeps its id from one day to the next. The one-off simulation
 * afternoon is always forty days away, as it was in On Call's demo.
 *
 * What's on (master plan R8) adds two more made-up services in the made-up "Demo health
 * service", each opening its weekly sessions to it: five open sessions every week. The
 * demo viewer is a visitor there, so those sessions open read-only.
 */

export const DEMO_TEACHING_SERVICE_ID = "00000000-0000-4000-9000-000000000001";

export const DEMO_TEACHING_TEAM: TeamSummary = {
  id: DEMO_TEACHING_SERVICE_ID,
  name: "Demo teaching service",
  role: "doctor",
  acceptsRealData: true,
  isDemo: true,
};

type DemoSeries = {
  readonly key: number;
  readonly title: string;
  /** Fixed anchor for a repeating series; null for the one-off. */
  readonly anchor: string | null;
  readonly anchorOffsetDays: number;
  readonly frequency: RecurringSessionFrequency | null;
  readonly startTime: string;
  readonly minutes: number;
  readonly venue: string;
  readonly presenter: boolean;
  readonly joinLink: boolean;
  /** Master plan R4: which level the series is for. Left out, it is for all doctors. */
  readonly audience?: SeriesAudience;
};

/** A weekly series another made-up service has opened to the demo health service. */
type DemoOpenSeries = DemoSeries & { readonly serviceId: string; readonly teamName: string };

const DEMO_SERIES: readonly DemoSeries[] = [
  {
    key: 1,
    title: "Demo registrar teaching",
    anchor: "2026-01-07",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "08:00",
    minutes: 60,
    venue: "Demo seminar room",
    presenter: true,
    joinLink: true,
    audience: "registrars",
  },
  {
    key: 2,
    title: "Demo journal club",
    anchor: "2026-01-15",
    anchorOffsetDays: 0,
    frequency: "monthly",
    startTime: "13:00",
    minutes: 60,
    venue: "Demo seminar room",
    presenter: false,
    joinLink: false,
  },
  {
    key: 3,
    title: "Demo case conference",
    anchor: "2026-01-05",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "12:30",
    minutes: 60,
    venue: "Demo seminar room",
    presenter: true,
    joinLink: true,
  },
  {
    key: 4,
    title: "Demo exam preparation group",
    anchor: "2026-01-08",
    anchorOffsetDays: 0,
    frequency: "fortnightly",
    startTime: "17:00",
    minutes: 90,
    venue: "Demo tutorial room",
    presenter: false,
    joinLink: false,
    audience: "registrars",
  },
  {
    key: 5,
    title: "Demo grand rounds",
    anchor: "2026-01-22",
    anchorOffsetDays: 0,
    frequency: "monthly",
    startTime: "12:00",
    minutes: 60,
    venue: "Demo lecture theatre",
    presenter: true,
    joinLink: true,
  },
  {
    key: 6,
    title: "Demo simulation afternoon",
    anchor: null,
    anchorOffsetDays: 40,
    frequency: null,
    startTime: "13:00",
    minutes: 180,
    venue: "Demo simulation suite",
    presenter: true,
    joinLink: false,
  },
  {
    key: 7,
    title: "Demo supervision hour",
    anchor: "2026-01-09",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "16:00",
    minutes: 60,
    venue: "Demo meeting room",
    presenter: false,
    joinLink: false,
  },
];

export const DEMO_OLDER_ADULT_SERVICE_ID = "00000000-0000-4000-9000-000000000002";
export const DEMO_YOUTH_SERVICE_ID = "00000000-0000-4000-9000-000000000003";
const OLDER_ADULT = { serviceId: DEMO_OLDER_ADULT_SERVICE_ID, teamName: "Demo older adult service" } as const;
const YOUTH = { serviceId: DEMO_YOUTH_SERVICE_ID, teamName: "Demo youth service" } as const;

/** Keys 11 to 15, so their occurrence ids never meet the demo service's own (1 to 7). */
const DEMO_OPEN_SERIES: readonly DemoOpenSeries[] = [
  {
    ...OLDER_ADULT,
    key: 11,
    title: "Demo psychopharmacology update",
    anchor: "2026-01-07",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "11:15",
    minutes: 60,
    venue: "Demo older adult unit, also on Teams",
    presenter: true,
    joinLink: true,
  },
  {
    ...OLDER_ADULT,
    key: 12,
    title: "Demo ECT journal club",
    anchor: "2026-01-07",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "13:00",
    minutes: 60,
    venue: "Demo older adult unit, also on Teams",
    presenter: false,
    joinLink: true,
    audience: "registrars",
  },
  {
    ...OLDER_ADULT,
    key: 13,
    title: "Demo delirium teaching",
    anchor: "2026-01-08",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "08:00",
    minutes: 60,
    venue: "Demo education centre",
    presenter: true,
    joinLink: false,
    audience: "interns",
  },
  {
    ...YOUTH,
    key: 14,
    title: "Demo eating disorders case conference",
    anchor: "2026-01-07",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "14:00",
    minutes: 60,
    venue: "Demo youth unit, also on Teams",
    presenter: true,
    joinLink: true,
    audience: "consultants",
  },
  {
    ...YOUTH,
    key: 15,
    title: "Demo early psychosis seminar",
    anchor: "2026-01-08",
    anchorOffsetDays: 0,
    frequency: "weekly",
    startTime: "15:00",
    minutes: 60,
    venue: "Demo seminar room 4",
    presenter: false,
    joinLink: false,
    audience: "residents",
  },
];

const DEMO_PRESENTER = "Demo presenter";
const DEMO_JOIN_URL = "https://example.org/demo-teaching-join";
const DEMO_MATERIAL = { label: "Demo reading list", url: "https://example.org/demo-reading" };
/** The next case conference is shown moved, so the change notice has something to show. */
const MOVED_SERIES_KEY = 3;
const MOVED_VENUE = "Demo lecture theatre";
const MAX_DEMO_OCCURRENCES = 60;
const ID_PATTERN = /^00000000-0000-4000-9(\d{3})-(\d{8})0000$/;

/** A stable, valid uuid for one occurrence: the series key and the date are readable in it. */
export function demoOccurrenceId(key: number, date: string): string {
  return `00000000-0000-4000-9${String(key).padStart(3, "0")}-${date.replace(/-/g, "")}0000`;
}

function demoNoticeId(key: number, date: string): string {
  return `00000000-0000-4000-a${String(key).padStart(3, "0")}-${date.replace(/-/g, "")}0000`;
}

function anchorOf(series: DemoSeries, today: string): string {
  return series.anchor ?? addDays(today, series.anchorOffsetDays);
}

function datesBetween(series: DemoSeries, from: string, to: string, today: string): string[] {
  const anchor = anchorOf(series, today);
  const dates: string[] = [];
  let date = nextTeachingOccurrence(anchor, series.frequency, from);
  while (date && date <= to && dates.length < MAX_DEMO_OCCURRENCES) {
    dates.push(date);
    if (!series.frequency) break;
    date = nextTeachingOccurrence(anchor, series.frequency, addDays(date, 1));
  }
  return dates;
}

function movedDate(today: string): string | null {
  const series = DEMO_SERIES.find((candidate) => candidate.key === MOVED_SERIES_KEY);
  return series ? nextTeachingOccurrence(anchorOf(series, today), series.frequency, today) : null;
}

function isOpenSeries(series: DemoSeries | DemoOpenSeries): series is DemoOpenSeries {
  return "serviceId" in series;
}

function demoSummary(series: DemoSeries | DemoOpenSeries, date: string, today: string): SessionSummary {
  const startsAt = perthInstant(date, series.startTime);
  const moved = series.key === MOVED_SERIES_KEY && date === movedDate(today);
  return {
    occurrenceId: demoOccurrenceId(series.key, date),
    serviceId: isOpenSeries(series) ? series.serviceId : DEMO_TEACHING_SERVICE_ID,
    title: series.title,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + series.minutes * 60_000).toISOString(),
    venue: moved ? MOVED_VENUE : series.venue,
    hasJoinLink: series.joinLink,
    status: moved ? "moved" : "scheduled",
    isPresenter: false,
    source: "teaching",
  };
}

export function demoTeachingSessions(range: { from: string; to: string }, now: Date = new Date()): SessionSummary[] {
  const today = perthToday(now);
  return DEMO_SERIES.flatMap((series) =>
    datesBetween(series, range.from, range.to, today).map((date) => demoSummary(series, date, today)),
  ).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
}

export function demoTeachingWeek(range: { from: string; to: string }, now: Date = new Date()): TeachingWeek {
  const sessions = demoTeachingSessions(range, now);
  const notices: Notice[] = sessions
    .filter((session) => session.status === "moved")
    .map((session) => ({
      id: demoNoticeId(MOVED_SERIES_KEY, session.startsAt.slice(0, 10)),
      occurrenceId: session.occurrenceId,
      serviceId: DEMO_TEACHING_SERVICE_ID,
      kind: "moved" as const,
      createdAt: now.toISOString(),
    }));
  return { teams: [DEMO_TEACHING_TEAM], sessions, notices, attendance: [] };
}

function whatsOnRow(series: DemoSeries | DemoOpenSeries, date: string, today: string): WhatsOnRow {
  const own = !isOpenSeries(series);
  return {
    ...demoSummary(series, date, today),
    teamName: isOpenSeries(series) ? series.teamName : DEMO_TEACHING_TEAM.name,
    joinUrl: series.joinLink ? DEMO_JOIN_URL : null,
    own,
    // The demo service's own sessions are already in the viewer's week; an open one is not until added.
    inMyWeek: own,
    audience: series.audience ?? "all_doctors",
  };
}

/**
 * What's on for the demo (master plan R8): the demo service's own week, plus the five sessions the
 * two other made-up services open to the demo health service each week. Ordered as the database
 * orders it, by start time and then id.
 */
export function demoWhatsOnSessions(range: { from: string; to: string }, now: Date = new Date()): WhatsOnRow[] {
  const today = perthToday(now);
  return [...DEMO_SERIES, ...DEMO_OPEN_SERIES]
    .flatMap((series) =>
      datesBetween(series, range.from, range.to, today).map((date) => whatsOnRow(series, date, today)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.occurrenceId.localeCompare(b.occurrenceId));
}

/** The demo series' own ids, for resources linked to a whole series. */
export function demoSeriesId(key: number): string {
  return `00000000-0000-4000-b${String(key).padStart(3, "0")}-000000000000`;
}

/** A demo occurrence id read back into its series key and Perth date, or null. */
export function parseDemoOccurrenceId(occurrenceId: string): { key: number; date: string } | null {
  const match = ID_PATTERN.exec(occurrenceId);
  if (!match) return null;
  const compact = match[2];
  return { key: Number(match[1]), date: `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` };
}

export function demoTeachingSessionDetail(occurrenceId: string, now: Date = new Date()): SessionDetail | null {
  const parsed = parseDemoOccurrenceId(occurrenceId);
  if (!parsed) return null;
  const { key, date } = parsed;
  const series = [...DEMO_SERIES, ...DEMO_OPEN_SERIES].find((candidate) => candidate.key === key);
  if (!series) return null;
  const today = perthToday(now);
  if (!datesBetween(series, date, date, today).includes(date)) return null;
  const summary = demoSummary(series, date, today);
  // Master plan R5/R15: another service's open session is a read-only visitor view with no presenter name.
  const visitor = isOpenSeries(series);
  return {
    ...summary,
    joinUrl: series.joinLink ? DEMO_JOIN_URL : null,
    presenterName: series.presenter && !visitor ? DEMO_PRESENTER : null,
    materials: [DEMO_MATERIAL],
    changeReason: summary.status === "moved" ? "room_change" : null,
    canShowCode: false,
    counts: null,
    visitor,
  };
}

/** The two most recent past registrar teaching sessions: one self-declared, one checked in by code. */
export function demoTeachingLogbook(now: Date = new Date()): LogbookRow[] {
  const today = perthToday(now);
  const series = DEMO_SERIES[0];
  const dates = datesBetween(series, addDays(today, -21), addDays(today, -1), today).slice(-2);
  return dates
    .map((date, index): LogbookRow => {
      const session = demoSummary(series, date, today);
      return {
        occurrenceId: session.occurrenceId,
        method: index === 0 ? "self" : "code_room",
        recordedAt: session.startsAt,
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        serviceName: DEMO_TEACHING_TEAM.name,
        cpdEntryId: null,
      };
    })
    .reverse();
}
