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

/**
 * `YYYY-MM-DD` for a date, in the viewer's own zone rather than UTC.
 *
 * Local fields throughout, never `toISOString()`. Everyone using this app is in
 * Perth (UTC+8), where the UTC day is still yesterday until 08:00 — so a UTC
 * key would call this morning "yesterday" every morning, and anything comparing
 * a stored date against it would be a day out for a third of the working day.
 */
export function onCallLocalDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Milliseconds until the viewer's next local midnight, when
 * `onCallLocalDateKey` starts returning a different day. A page left open
 * overnight uses this to move "today" instead of keeping the day it opened on.
 * Never less than one second, so a timer set from it cannot spin.
 */
export function msUntilNextOnCallLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}
