/**
 * Minutes elapsed since midnight on the synthetic operating day.
 *
 * The whole model stores durations rather than fixed times so the board can tick. This is
 * the ONLY module permitted to read the wall clock: everything else receives `now` as a
 * parameter, which is what keeps tests and screenshots deterministic.
 */
/**
 * A point on the demo's timeline, in minutes, counted from midnight at the start of the day the
 * demonstration opened.
 *
 * IT IS NOT A TIME OF DAY, and reading it as one is the defect this comment exists to stop. Day 0 is
 * the opening day, so 642 is 10:42 that morning; 2082 is 10:42 the NEXT morning; and -798 is 10:42
 * the morning BEFORE. `ward-admissions-seed.ts` has always relied on this - `arrivedAt` for someone
 * admitted four days ago is `ANCHOR - 4 * MINUTES_PER_DAY`, a large negative number - and
 * `daysInBed` divides the difference by `MINUTES_PER_DAY` to count days.
 *
 * The value therefore has TWO parts, and code that needs one must not read the other: `dayOf` for
 * which day, `minuteOfDay` for the clock face. Differences between two instants are plain
 * subtraction and are correct across any number of days.
 */
export type Instant = number;

export type ClockState = "breached" | "critical" | "due" | "clear";

/** Minutes in a day. `wallClockNow()` wraps to 0 at 24:00, so anything that measures elapsed
 * time across two of its readings has to know this to unwrap the rollover. */
export const MINUTES_PER_DAY = 24 * 60;

export function wallClockNow(): Instant {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Minutes elapsed between two `wallClockNow()` readings — a mount instant and a later
 * reading, both already resolved by the caller. `wallClockNow()` wraps to 0 at 24:00: a
 * session mounted late in the day and read again after midnight sees `current < mountedAt`
 * even though real time moved forward, so a plain subtraction goes negative and, clamped at
 * zero, makes the clock look frozen. A negative difference here can only mean the day rolled
 * over exactly once, so add one day's worth of minutes back in. This function never reads the
 * wall clock itself — both instants are supplied by the caller.
 */
export function elapsedMinutesSinceMount(mountedAt: Instant, current: Instant): number {
  const raw = current - mountedAt;
  return raw < 0 ? raw + MINUTES_PER_DAY : raw;
}

export function minutesUntil(due: Instant, now: Instant) {
  return due - now;
}

export function clockState(due: Instant, now: Instant): ClockState {
  const remaining = minutesUntil(due, now);
  if (remaining < 0) return "breached";
  if (remaining < 60) return "critical";
  if (remaining < 180) return "due";
  return "clear";
}

/** Which day of the demo an instant falls on. 0 is the opening day, -1 the day before, 1 the next. */
export function dayOf(instant: Instant): number {
  return Math.floor(instant / MINUTES_PER_DAY);
}

/** The clock face of an instant, 0-1439, with the day discarded. */
export function minuteOfDay(instant: Instant): number {
  return ((instant % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Whole days from one instant to another, floored - the same count `daysInBed` produces. */
export function daysBetween(from: Instant, to: Instant): number {
  return Math.floor((to - from) / MINUTES_PER_DAY);
}

/**
 * A length of time, in the units a person would actually say it in.
 *
 * Under an hour: minutes. Under a day: hours and minutes. A day or more: DAYS and hours, because
 * beyond that scale minutes are noise nobody reads.
 *
 * The last part is a fix rather than a preference. This function used to return hours however large
 * the number got, and the out-of-area screen rendered seeded stays of one to two hundred days as
 * everything from `25h 30m` to `5041h 30m` - every figure correct, every figure unreadable, and the
 * whole suite green, because no assertion was ever about the format. That screen was repaired on its
 * own by switching to a day count; every other screen kept calling this and kept the defect. Fixing
 * it here is what makes a wait longer than a day readable everywhere at once.
 */
export function splitDuration(totalMinutes: number) {
  if (totalMinutes >= MINUTES_PER_DAY) {
    const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatRemaining(minutes: number) {
  if (minutes < 0) return `${splitDuration(Math.abs(minutes))} overdue`;
  return `${splitDuration(minutes)} left`;
}

/**
 * Formats a duration that has already elapsed (e.g. time since a movement opened).
 * `formatRemaining` is a countdown formatter — "left"/"overdue" against a future deadline —
 * and must not be reused for elapsed time, which has no deadline to be overdue against.
 */
export function formatElapsed(minutes: number) {
  return `${splitDuration(Math.max(minutes, 0))} waiting`;
}

/**
 * A synthetic movement can be authored with a negative instant (e.g. `openedAt` computed
 * before the day began) — this must still render as a valid wall-clock time rather than
 * `-1:-14`, so wrap into the 0–1439 range before splitting into hours and minutes.
 */
export function formatInstant(instant: Instant) {
  const wrapped = ((instant % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
