import type { OnCallShift } from "@/lib/on-call/shifts/model";
import { addDaysToDate, formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/on-call/shifts/perth-time";

/**
 * The shift the On Call home leads with: the one on now, or else the next one.
 */

export type NextShift = {
  readonly shift: OnCallShift;
  readonly onNow: boolean;
  /** "On now until 17:00", "Starts in 2 h 15 min", "Tomorrow at 07:30", "Mon 3 Oct at 07:30". */
  readonly when: string;
  /** "07:30 to 17:00", with "(next day)" when it ends after midnight. */
  readonly hours: string;
};

export function selectNextShift(shifts: readonly OnCallShift[], now: Date): OnCallShift | null {
  const at = now.getTime();
  let best: OnCallShift | null = null;
  for (const shift of shifts) {
    const start = Date.parse(shift.startsAt);
    const end = Date.parse(shift.endsAt);
    if (end <= at) continue;
    if (!best || start < Date.parse(best.startsAt)) best = shift;
  }
  return best;
}

export function shiftHours(shift: Pick<OnCallShift, "startsAt" | "endsAt">): string {
  const sameDay = perthDateOf(shift.startsAt) === perthDateOf(shift.endsAt);
  return `${perthTimeOf(shift.startsAt)} to ${perthTimeOf(shift.endsAt)}${sameDay ? "" : " (next day)"}`;
}

export function describeNextShift(shifts: readonly OnCallShift[], now: Date): NextShift | null {
  const shift = selectNextShift(shifts, now);
  if (!shift) return null;
  const start = Date.parse(shift.startsAt);
  const onNow = start <= now.getTime();
  let when: string;
  if (onNow) {
    when = `On now until ${perthTimeOf(shift.endsAt)}`;
  } else {
    const minutes = Math.round((start - now.getTime()) / 60000);
    const today = perthDateOf(now);
    const day = perthDateOf(shift.startsAt);
    if (minutes < 12 * 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      when = `Starts in ${hours > 0 ? `${hours} h ` : ""}${rest} min`.replace(" 0 min", "").trim();
      if (hours === 0 && rest === 0) when = "Starts now";
    } else if (day === today) when = `Today at ${perthTimeOf(shift.startsAt)}`;
    else if (day === addDaysToDate(today, 1)) when = `Tomorrow at ${perthTimeOf(shift.startsAt)}`;
    else when = `${formatPerthDay(day)} at ${perthTimeOf(shift.startsAt)}`;
  }
  return { shift, onNow, when, hours: shiftHours(shift) };
}
