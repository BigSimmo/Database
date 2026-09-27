"use client";

import { useEffect, useState } from "react";

import { inferShiftKind, type ShiftKind } from "@/lib/roster/shift-kind";
import type { OnCallShift, OnCallShiftInput } from "@/lib/roster/shifts/model";
import { perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";

/**
 * Small shared words and numbers for the Roster screens. Times are Perth,
 * 24-hour; ranges use an en dash; a range that ends the next day carries "+1";
 * a number and its unit are joined by a non-breaking space.
 */

const NBSP = " ";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** The shift's kind, inferred from its title and times when it was never set. */
export function kindOf(shift: Pick<OnCallShiftInput, "startsAt" | "endsAt" | "title" | "kind">): ShiftKind {
  return shift.kind ?? inferShiftKind(shift);
}

/** The shift's start and end times, and whether it ends on a later Perth day. */
export function shiftTimes(shift: Pick<OnCallShift, "startsAt" | "endsAt">) {
  return {
    start: perthTimeOf(shift.startsAt),
    end: perthTimeOf(shift.endsAt),
    plusOne: perthDateOf(shift.startsAt) !== perthDateOf(shift.endsAt) && perthTimeOf(shift.endsAt) !== "00:00",
  };
}

/** `21:30–08:00 +1`. */
export function formatShiftRange(shift: Pick<OnCallShift, "startsAt" | "endsAt">): string {
  const { start, end, plusOne } = shiftTimes(shift);
  return `${start}–${end}${plusOne ? " +1" : ""}`;
}

/** `76.5 h`, `1.25 h`, `5 h`. */
export function formatHours(hours: number): string {
  const text = hours.toFixed(2).replace(/\.?0+$/, "");
  return `${text}${NBSP}h`;
}

/** `4 h 48 min`, `55 min`, `3 h`. Never negative. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}${NBSP}min`;
  return rest === 0 ? `${hours}${NBSP}h` : `${hours}${NBSP}h ${rest}${NBSP}min`;
}

function parts(date: string) {
  return { day: Number(date.slice(8, 10)), month: MONTHS[Number(date.slice(5, 7)) - 1] };
}

/** `15 Oct`, `19–22 Oct`, or `30 Oct – 2 Nov`. */
export function formatDateSpan(start: string, end: string): string {
  const first = parts(start);
  const last = parts(end);
  if (start === end) return `${first.day} ${first.month}`;
  if (first.month === last.month) return `${first.day}–${last.day} ${last.month}`;
  return `${first.day} ${first.month} – ${last.day} ${last.month}`;
}

/**
 * The time to show: `now` when a test or parent pins it, else the clock,
 * moved on each minute so countdowns and the 3 am dial keep up.
 */
export function useRosterNow(pinned?: Date): Date {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    if (pinned) return;
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [pinned]);
  return pinned ?? clock;
}
