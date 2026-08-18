/**
 * Minutes elapsed since midnight on the synthetic operating day.
 *
 * The whole model stores durations rather than fixed times so the board can tick. This is
 * the ONLY module permitted to read the wall clock: everything else receives `now` as a
 * parameter, which is what keeps tests and screenshots deterministic.
 */
export type Instant = number;

export type ClockState = "breached" | "critical" | "due" | "clear";

export function wallClockNow(): Instant {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
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

function splitDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatRemaining(minutes: number) {
  if (minutes < 0) return `${splitDuration(Math.abs(minutes))} overdue`;
  return `${splitDuration(minutes)} left`;
}

export function formatInstant(instant: Instant) {
  const hours = Math.floor(instant / 60) % 24;
  const minutes = instant % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
