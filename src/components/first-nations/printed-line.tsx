"use client";
import { useSyncExternalStore } from "react";
import { awstCalendarDay, awstCalendarDayOffset } from "@/lib/caring-contacts/clock";
import { formatDayMonthYear } from "@/lib/first-nations/contact-format";

const RECHECK_DAYS = 90;
const noSubscription = () => () => {};

export function printedLineText(printedOn: string): string {
  return `Printed ${formatDayMonthYear(printedOn)} · recheck by ${formatDayMonthYear(awstCalendarDayOffset(printedOn, RECHECK_DAYS))}`;
}

/**
 * The day the card is printed, read from the phone's clock in Perth time. A server
 * render (which may be cached from build time) never stamps a date, so paper never
 * carries a date that is not the day it was printed.
 */
export function PrintedLine({ printedOn, className }: { printedOn?: string; className?: string }) {
  const today = useSyncExternalStore(
    noSubscription,
    () => awstCalendarDay(new Date()),
    () => null,
  );
  const day = printedOn ?? today;
  return <p className={className}>{day ? printedLineText(day) : "Recheck the numbers every 90 days"}</p>;
}
