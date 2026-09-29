/**
 * The viewer's own calendar day, as a `YYYY-MM-DD` key.
 *
 * Its own module, and deliberately a tiny one. It used to live in
 * `home-modules.ts`, which is about the home's tag-driven modules and has
 * nothing to do with dates; that misplacement became a real problem the moment
 * `compliance.ts` needed the same helper, because `home-modules.ts` also needs
 * to ask `compliance.ts` which rows are requirements — a cycle that TypeScript
 * accepts, no lint rule here catches, and ES modules resolve by handing one
 * side an undefined binding if either ever reads the other at module-init
 * time. A leaf module both can depend on removes the trap rather than
 * documenting it.
 */

export const ON_CALL_TIME_ZONE = "Australia/Perth";

const PERTH_CALENDAR_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ON_CALL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * `YYYY-MM-DD` for a date, pinned to `Australia/Perth` rather than the device/server zone.
 *
 * Everyone using this app is in Perth (UTC+8), where the UTC day is still yesterday until 08:00 — so a UTC
 * key would call this morning "yesterday" every morning, and anything comparing
 * a stored date against it would be a day out for a third of the working day.
 * Pinned to Australia/Perth so server, CI, and interstate devices read the identical calendar date.
 */
export function onCallLocalDateKey(now: Date): string {
  return PERTH_CALENDAR_DAY_FORMAT.format(now);
}

/**
 * Milliseconds until Perth's next local midnight, when
 * `onCallLocalDateKey` starts returning a different day. A page left open
 * overnight uses this to move "today" instead of keeping the day it opened on.
 * Never less than one second, so a timer set from it cannot spin.
 */
export function msUntilNextOnCallLocalDay(now: Date): number {
  const [year, month, day] = onCallLocalDateKey(now).split("-").map(Number);
  // Perth is UTC+8 with no daylight saving. Next local midnight in Perth is:
  const nextPerthMidnight = Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0);
  return Math.max(1000, nextPerthMidnight - now.getTime());
}
