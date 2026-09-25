import mhaTimeframes from "../../data/mha-timeframes.json";
import {
  AWST_TIME_ZONE,
  awstCalendarDay,
  awstCalendarDayOffset,
  awstWallTimeToInstant,
  toAwstParts,
} from "@/lib/caring-contacts/clock";

/**
 * Mental Health Act 2014 (WA) time limits for the form-page Timeline.
 *
 * THE OWNER'S RULE, and the reason this module is shaped the way it is: a statutory time
 * limit may appear only as a verbatim quote from the pinned Act text
 * (`data/mha-2014-sections.source.json`), and a computed Perth clock time may appear only for
 * an entry the owner has signed off — `status: "reviewed"` with a named reviewer and a date.
 * Agents write entries as `drafted` and never sign them. A drafted entry renders its quote and
 * nothing else; the engine does not calculate a time for it.
 *
 * `timeframeContractProblems` is the mechanical half of that rule and is run against the whole
 * file by `tests/mha-timeframes-contract.test.ts`: every quote must be a whitespace-normalised
 * substring of its section's text, and every duration the engine counts with must be written,
 * digit for digit, inside its quote. A figure that is not in the Act cannot reach the page.
 */

export type MhaTimeframeUnit = "hours" | "days";

export type MhaTimeframeStatus = "drafted" | "reviewed";

export type MhaTimeframeEntry = {
  id: string;
  /** Form codes as `data/forms-catalog.json` writes them (`form` field), e.g. "3A". */
  formCodes: string[];
  /** What the time limit is for, in plain words. */
  trigger: string;
  /** The Act section number, as `data/mha-2014-sections.source.json` keys it. */
  section: string;
  /** Verbatim (whitespace-normalised) text from that section, containing the duration. */
  quote: string;
  duration: { value: number; unit: MhaTimeframeUnit };
  /** The event the period is counted from, in plain words. */
  anchor: string;
  status: MhaTimeframeStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewedContentSha256: string | null;
};

export type MhaTimeframesFile = {
  exportMetadata: {
    format: "mha-timeframes";
    formatVersion: 1;
    actVersion: string;
    actAsAt: string;
  };
  entries: MhaTimeframeEntry[];
};

export type MhaTimelineItem =
  { entry: MhaTimeframeEntry; quoteOnly: true } | { entry: MhaTimeframeEntry; quoteOnly: false; deadline: Date | null };

const shippedEntries = (mhaTimeframes as MhaTimeframesFile).entries;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Collapse every run of whitespace to one space, so a quote survives line-wrapping in the source. */
export function normaliseActText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseFormCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Does the quote state this duration as the Act writes it — "72 hours", "6-hour", "3 days"?
 * The digit boundary stops "144 hours" from satisfying a 44-hour entry.
 */
function quoteStatesDuration(quote: string, duration: MhaTimeframeEntry["duration"]): boolean {
  const singular = duration.unit === "hours" ? "hour" : "day";
  return new RegExp(`(?:^|[^\\d])${duration.value}(?:\\s+${singular}s?|-${singular})\\b`).test(quote);
}

/**
 * Every way these entries break the timeline contract, as readable sentences. Empty means clean.
 *
 * Pure, so the contract test can prove an invented entry fails as well as that the shipped
 * file passes. `sourceSections` is the pinned Act text; it is passed in rather than imported
 * so the (large) source file never enters the page bundle.
 */
export function timeframeContractProblems(
  entries: readonly MhaTimeframeEntry[],
  sourceSections: readonly { section: string; text: string }[],
  knownFormCodes: readonly string[],
): string[] {
  const problems: string[] = [];
  const sectionText = new Map(sourceSections.map((entry) => [entry.section, normaliseActText(entry.text)]));
  const forms = new Set(knownFormCodes.map(normaliseFormCode));
  const seen = new Set<string>();

  for (const entry of entries) {
    const label = hasText(entry.id) ? entry.id : "(entry without an id)";
    if (!hasText(entry.id)) problems.push(`${label}: missing id`);
    else if (seen.has(entry.id)) problems.push(`${label}: duplicate id`);
    else seen.add(entry.id);

    if (!Array.isArray(entry.formCodes) || entry.formCodes.length === 0) {
      problems.push(`${label}: names no form codes`);
    } else {
      for (const code of entry.formCodes) {
        if (!hasText(code) || !forms.has(normaliseFormCode(code)))
          problems.push(`${label}: unknown form code "${code}"`);
      }
    }

    if (!hasText(entry.trigger)) problems.push(`${label}: missing trigger`);
    if (!hasText(entry.anchor)) problems.push(`${label}: missing anchor`);

    const { value, unit } = entry.duration ?? ({} as MhaTimeframeEntry["duration"]);
    const unitOk = unit === "hours" || unit === "days";
    if (!unitOk) problems.push(`${label}: duration unit must be "hours" or "days", got "${String(unit)}"`);
    const valueOk = Number.isInteger(value) && value > 0;
    if (!valueOk) problems.push(`${label}: duration value must be a positive whole number, got ${String(value)}`);

    const text = sectionText.get(entry.section);
    if (text === undefined) {
      problems.push(`${label}: section ${entry.section} is not in the pinned Act text`);
    } else if (!hasText(entry.quote)) {
      problems.push(`${label}: missing quote`);
    } else {
      if (!text.includes(normaliseActText(entry.quote))) {
        problems.push(`${label}: quote is not a verbatim substring of section ${entry.section}`);
      }
      if (unitOk && valueOk && !quoteStatesDuration(entry.quote, entry.duration)) {
        problems.push(`${label}: quote does not state the duration "${value} ${unit}"`);
      }
    }

    if (entry.status === "drafted") {
      if (entry.reviewedBy !== null || entry.reviewedAt !== null || entry.reviewedContentSha256 !== null) {
        problems.push(`${label}: a drafted entry must not carry reviewedBy, reviewedAt or reviewedContentSha256`);
      }
    } else if (entry.status === "reviewed") {
      if (!hasText(entry.reviewedBy) || !hasText(entry.reviewedAt) || !hasText(entry.reviewedContentSha256)) {
        problems.push(`${label}: a reviewed entry needs reviewedBy, reviewedAt and reviewedContentSha256`);
      }
    } else {
      problems.push(`${label}: status must be "drafted" or "reviewed", got "${String(entry.status)}"`);
    }
  }

  return problems;
}

/**
 * Signed off by a named person on a stated date. Anything short of that — including a
 * `reviewed` status with a blank reviewer — is treated as drafted, so the page fails closed
 * to quote-only.
 */
export function isReviewedTimeframe(entry: MhaTimeframeEntry): boolean {
  return entry.status === "reviewed" && hasText(entry.reviewedBy) && hasText(entry.reviewedAt);
}

/**
 * The instant a period ends, counted from `start`.
 *
 * Hours are elapsed time. Days are Perth calendar days: the same Perth wall-clock time that
 * many days later, stepped through the Perth calendar so month ends and 29 February fall out
 * of the calendar rather than out of a day-length assumption. (Perth keeps UTC+8 all year, so
 * the two agree; the calendar route is the one that stays correct if that ever changes.)
 */
export function computeDeadline(entry: MhaTimeframeEntry, start: Date): Date {
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) throw new Error("computeDeadline: invalid start instant");
  const { value, unit } = entry.duration;
  if (!Number.isInteger(value) || value <= 0) throw new Error(`computeDeadline: invalid duration for ${entry.id}`);

  if (unit === "hours") return new Date(startMs + value * HOUR_MS);
  if (unit === "days") {
    const { hour, minute } = toAwstParts(start);
    const endDay = awstCalendarDayOffset(awstCalendarDay(start), value);
    // Wall time carries whole minutes; add back the seconds and milliseconds of the start.
    const subMinuteMs = ((startMs % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
    return new Date(awstWallTimeToInstant(endDay, hour, minute).getTime() + subMinuteMs);
  }
  throw new Error(`computeDeadline: unsupported unit for ${entry.id}`);
}

function durationHours(entry: MhaTimeframeEntry): number {
  return entry.duration.unit === "days" ? entry.duration.value * 24 : entry.duration.value;
}

/**
 * A form's timeline, shortest period first (file order breaks ties). Drafted entries come back
 * quote-only with no `deadline` at all; reviewed ones carry the computed instant, or `null`
 * until a start is known.
 */
export function timelineFor(
  formCode: string,
  start: Date | null,
  entries: readonly MhaTimeframeEntry[] = shippedEntries,
): MhaTimelineItem[] {
  const code = normaliseFormCode(formCode);
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.formCodes.some((candidate) => normaliseFormCode(candidate) === code))
    .sort((a, b) => durationHours(a.entry) - durationHours(b.entry) || a.index - b.index)
    .map(({ entry }): MhaTimelineItem => {
      if (!isReviewedTimeframe(entry)) return { entry, quoteOnly: true };
      return { entry, quoteOnly: false, deadline: start ? computeDeadline(entry, start) : null };
    });
}

export function hasMhaTimeline(formCode: string): boolean {
  const code = normaliseFormCode(formCode);
  return shippedEntries.some((entry) => entry.formCodes.some((candidate) => normaliseFormCode(candidate) === code));
}

/**
 * A `datetime-local` value ("2026-09-25T14:30") read as Perth wall time, whatever time zone
 * the browser is in. Returns null for anything that is not a real calendar date and time.
 */
export function parsePerthDateTimeInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  const calendarDay = `${match[1]}-${match[2]}-${match[3]}`;
  return awstWallTimeToInstant(calendarDay, hour, minute);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-AU", { timeZone: AWST_TIME_ZONE, weekday: "short" });

/** "Fri 25 Sep 2026, 14:30 (Perth time)". */
export function formatPerthDateTime(instant: Date): string {
  const { year, month, day, hour, minute } = toAwstParts(instant);
  const weekday = WEEKDAY_FORMAT.format(instant);
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${weekday} ${day} ${MONTHS[month - 1]} ${year}, ${time} (Perth time)`;
}
