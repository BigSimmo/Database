"use client";
import { useSyncExternalStore } from "react";
import { awstCalendarDay, awstCalendarDayOffset } from "@/lib/caring-contacts/clock";
import { formatDayMonthYear } from "@/lib/first-nations/contact-format";

const RECHECK_DAYS = 90;
const noSubscription = () => () => {};

export function printedLineText(printedOn: string, checkedAt: string): string {
  const due = awstCalendarDayOffset(checkedAt, RECHECK_DAYS);
  return `Printed ${formatDayMonthYear(printedOn)} · checked ${formatDayMonthYear(checkedAt)} · ${printedOn > due ? "due for a check since" : "recheck by"} ${formatDayMonthYear(due)}`;
}

/**
 * The day the card is printed, read from the phone's clock in Perth time. A server
 * render (which may be cached from build time) never stamps a date, so paper never
 * carries a date that is not the day it was printed.
 */
export function PrintedLine({
  printedOn,
  checkedAt,
  className,
}: {
  printedOn?: string;
  checkedAt: string;
  className?: string;
}) {
  const today = useSyncExternalStore(
    noSubscription,
    () => awstCalendarDay(new Date()),
    () => null,
  );
  const day = printedOn ?? today;
  return (
    <p className={className}>
      {day
        ? printedLineText(day, checkedAt)
        : `Checked ${formatDayMonthYear(checkedAt)} · recheck by ${formatDayMonthYear(awstCalendarDayOffset(checkedAt, RECHECK_DAYS))}`}
    </p>
  );
}
