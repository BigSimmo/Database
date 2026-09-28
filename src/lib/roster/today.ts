import type { ShiftKind } from "@/lib/roster/shift-kind";
import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";

/**
 * What Today leads with, worked out once from the doctor's own shifts. The
 * page never guesses beyond what the roster covers: "next weekend off" is only
 * given inside the dates the doctor's shifts are known for.
 */

export type TodayShift = {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly kind: ShiftKind;
};

export type TodayState =
  | { readonly state: "empty" }
  | { readonly state: "on_now"; readonly shift: TodayShift; readonly isNight: boolean }
  | { readonly state: "before"; readonly shift: TodayShift }
  | {
      readonly state: "day_off";
      readonly next: TodayShift | null;
      /**
       * A worked shift already ended today. The page then says "Finished for
       * today" rather than "Day off", which contradicted the week strip
       * showing that same shift under today's date.
       */
      readonly finishedToday: boolean;
    };

export type TodaySummary = {
  readonly lead: TodayState;
  /** Monday-to-Sunday week holding today: the letter squares. */
  readonly week: { readonly date: string; readonly kinds: ShiftKind[] }[];
  readonly nextNights: { readonly start: string; readonly end: string } | null;
  readonly nextLeave: { readonly start: string; readonly end: string } | null;
  /** Saturday and Sunday with no worked shift starting on either, within the known roster. */
  readonly nextWeekendOff: { readonly saturday: string; readonly sunday: string } | null;
};

const WORKED: ReadonlySet<ShiftKind> = new Set(["day", "evening", "night", "other", "on_call"]);

/** Consecutive dates starting from the first date on or after `from`. */
function nextRun(dates: readonly string[], from: string): { start: string; end: string } | null {
  const sorted = [...new Set(dates)].filter((date) => date >= from).sort();
  const start = sorted[0];
  if (!start) return null;
  let end = start;
  while (sorted.includes(addDaysToDate(end, 1))) end = addDaysToDate(end, 1);
  return { start, end };
}

export function summariseToday(shifts: readonly TodayShift[], now: Date): TodaySummary {
  const sorted = [...shifts].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const at = now.getTime();
  const today = perthDateOf(now);
  const working = sorted.filter((shift) => shift.kind !== "leave");

  let lead: TodayState;
  const onNow = working.find((shift) => Date.parse(shift.startsAt) <= at && Date.parse(shift.endsAt) > at);
  const next = working.find((shift) => Date.parse(shift.startsAt) > at) ?? null;
  if (sorted.length === 0) lead = { state: "empty" };
  else if (onNow) lead = { state: "on_now", shift: onNow, isNight: onNow.kind === "night" };
  else if (next && perthDateOf(next.startsAt) === today) lead = { state: "before", shift: next };
  else {
    // An end at exactly midnight belongs to the day before, as leave does below.
    const finishedToday = working.some(
      (shift) => Date.parse(shift.endsAt) <= at && perthDateOf(new Date(Date.parse(shift.endsAt) - 1)) === today,
    );
    lead = { state: "day_off", next, finishedToday };
  }

  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDaysToDate(today, -weekday);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDate(monday, index);
    return { date, kinds: sorted.filter((shift) => perthDateOf(shift.startsAt) === date).map((shift) => shift.kind) };
  });

  const nights = sorted.filter((shift) => shift.kind === "night").map((shift) => perthDateOf(shift.startsAt));
  const leaveDates = sorted.flatMap((shift) => {
    if (shift.kind !== "leave") return [];
    const dates: string[] = [];
    // Leave ending at midnight covers the days before it, not the next one.
    const last = perthDateOf(new Date(Date.parse(shift.endsAt) - 1));
    for (let date = perthDateOf(shift.startsAt); date <= last; date = addDaysToDate(date, 1)) dates.push(date);
    return dates;
  });

  const lastKnown = sorted.length > 0 ? perthDateOf(sorted.at(-1)!.startsAt) : null;
  const workedDates = new Set(
    sorted.filter((shift) => WORKED.has(shift.kind)).map((shift) => perthDateOf(shift.startsAt)),
  );
  let nextWeekendOff: TodaySummary["nextWeekendOff"] = null;
  if (lastKnown) {
    const firstSaturday = addDaysToDate(today, (5 - weekday + 7) % 7);
    for (let saturday = firstSaturday; addDaysToDate(saturday, 1) <= lastKnown; saturday = addDaysToDate(saturday, 7)) {
      const sunday = addDaysToDate(saturday, 1);
      if (!workedDates.has(saturday) && !workedDates.has(sunday)) {
        nextWeekendOff = { saturday, sunday };
        break;
      }
    }
  }

  return {
    lead,
    week,
    nextNights: nextRun(nights, today),
    nextLeave: nextRun(leaveDates, today),
    nextWeekendOff,
  };
}
