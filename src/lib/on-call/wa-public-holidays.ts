import { onCallLocalDateKey } from "@/lib/on-call/local-date";

/**
 * Western Australian public holidays, as published by the WA Government
 * ("Public holidays in Western Australia", wa.gov.au, page last updated
 * 2 September 2026, read 2026-09-25). Includes the substitute Mondays and
 * Tuesdays the page lists when a holiday falls on a weekend.
 *
 * Used only to decide which escalation steps to lead with: on a public holiday
 * a service runs its after-hours arrangements. Every step stays visible either
 * way, so a missing date costs a glance, not a missed call.
 *
 * UPDATE YEARLY. The 2028 dates were not yet published when this list was
 * written; after the last listed year the app falls back to the weekday rule
 * alone. Regional King's Birthday dates (Karratha, Port Hedland) are not
 * included.
 */
export const WA_PUBLIC_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01",
  "2026-01-26",
  "2026-03-02",
  "2026-04-03",
  "2026-04-05",
  "2026-04-06",
  "2026-04-25",
  "2026-04-27",
  "2026-06-01",
  "2026-09-28",
  "2026-12-25",
  "2026-12-26",
  "2026-12-28",
  // 2027
  "2027-01-01",
  "2027-01-26",
  "2027-03-01",
  "2027-03-26",
  "2027-03-28",
  "2027-03-29",
  "2027-04-25",
  "2027-04-26",
  "2027-06-07",
  "2027-09-27",
  "2027-12-25",
  "2027-12-26",
  "2027-12-27",
  "2027-12-28",
]);

/** The last year the list covers, so a test can fail loudly once it runs out. */
export const WA_PUBLIC_HOLIDAYS_LAST_YEAR = 2027;

/**
 * Read in the viewer's own zone, like `isOnCallOutOfHours` beside it in "Who do
 * I call now?": the two answers combine into one "in hours or not", so they
 * must read the same clock. A Perth zone here against a device-local hour there
 * would disagree for the eight hours either side of midnight on any device not
 * set to Perth.
 */
export function isWaPublicHoliday(now: Date): boolean {
  return WA_PUBLIC_HOLIDAYS.has(onCallLocalDateKey(now));
}
