/**
 * The CPD year is a Perth year.
 *
 * Perth is UTC+8 with no daylight saving. Every date question this mode asks —
 * which year an activity belongs to, how far through the year we are, what the
 * current rate projects to — must be asked in that zone. Asked in UTC, an
 * activity logged between midnight and 08:00 on 1 January is filed against the
 * year that just closed, which is silent and wrong in the one record its owner
 * cannot afford to have wrong.
 *
 * `en-CA` is not a locale choice: it is the one built-in locale whose short date
 * format is already `YYYY-MM-DD`, so no reassembly is needed.
 */
export const CPD_TIME_ZONE = "Australia/Perth";

/**
 * Below this, a projection is arithmetic on noise: four weeks of a 52-week year
 * cannot say anything useful about December, and a confident wrong number in
 * January is worse than silence. The dashboard renders nothing about pace while
 * `paceProjection` returns null.
 */
export const CPD_PACE_MINIMUM_ELAPSED_DAYS = 28;

const perthDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CPD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MS_PER_DAY = 86_400_000;

export function perthCalendarDate(instant: Date): string {
  return perthDateFormatter.format(instant);
}

export function cpdYearOf(instant: Date): number {
  return Number.parseInt(perthCalendarDate(instant).slice(0, 4), 10);
}

export function cpdYearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function daysInCpdYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/** Whole days from 1 January of `year` to the Perth calendar date of `instant`, inclusive of the first. */
export function daysElapsedInCpdYear(instant: Date, year: number): number {
  const today = Date.parse(`${perthCalendarDate(instant)}T00:00:00Z`);
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  return Math.round((today - start) / MS_PER_DAY) + 1;
}

export function daysRemainingInCpdYear(instant: Date, year: number): number {
  return daysInCpdYear(year) - daysElapsedInCpdYear(instant, year);
}

/** Hours are read as hours. Two decimals, so no float artefact reaches a screen. */
function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function paceProjection(args: {
  hoursSoFar: number;
  targetHours: number;
  instant: Date;
  year: number;
}): { projectedHours: number; shortfallHours: number } | null {
  // A rate is only meaningful inside the year it was measured in. Asked about a
  // closed year, or one that has not started, `daysElapsedInCpdYear` returns a
  // number outside 1..365 and the projection built on it is confidently wrong —
  // the exact failure this module exists to prevent. Say nothing instead.
  if (cpdYearOf(args.instant) !== args.year) return null;
  const elapsed = daysElapsedInCpdYear(args.instant, args.year);
  if (elapsed < CPD_PACE_MINIMUM_ELAPSED_DAYS) return null;
  const projectedHours = roundHours((args.hoursSoFar / elapsed) * daysInCpdYear(args.year));
  return { projectedHours, shortfallHours: roundHours(Math.max(0, args.targetHours - projectedHours)) };
}
