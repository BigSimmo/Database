import { addDays } from "@/lib/calendar/calendar-event";
import { nextTeachingOccurrence, type RecurringSessionFrequency } from "@/lib/dates/recurring-session";
import type {
  LogbookRow,
  Notice,
  SessionDetail,
  SessionSummary,
  TeachingWeek,
  TeamSummary,
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
};

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

function demoSummary(series: DemoSeries, date: string, today: string): SessionSummary {
  const startsAt = perthInstant(date, series.startTime);
  const moved = series.key === MOVED_SERIES_KEY && date === movedDate(today);
  return {
    occurrenceId: demoOccurrenceId(series.key, date),
    serviceId: DEMO_TEACHING_SERVICE_ID,
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

export function demoTeachingSessionDetail(occurrenceId: string, now: Date = new Date()): SessionDetail | null {
  const match = ID_PATTERN.exec(occurrenceId);
  if (!match) return null;
  const series = DEMO_SERIES.find((candidate) => candidate.key === Number(match[1]));
  if (!series) return null;
  const compact = match[2];
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  const today = perthToday(now);
  if (!datesBetween(series, date, date, today).includes(date)) return null;
  const summary = demoSummary(series, date, today);
  return {
    ...summary,
    joinUrl: series.joinLink ? DEMO_JOIN_URL : null,
    presenterName: series.presenter ? DEMO_PRESENTER : null,
    materials: [DEMO_MATERIAL],
    changeReason: summary.status === "moved" ? "room_change" : null,
    canShowCode: false,
    counts: null,
    visitor: false,
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
