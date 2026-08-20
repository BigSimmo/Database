/**
 * Minutes elapsed since midnight on the synthetic operating day.
 *
 * The whole model stores durations rather than fixed times so the board can tick. This is
 * the ONLY module permitted to read the wall clock: everything else receives `now` as a
 * parameter, which is what keeps tests and screenshots deterministic.
 */
export type Instant = number;

export type ClockState = "breached" | "critical" | "due" | "clear";

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

export function splitDuration(totalMinutes: number) {
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
