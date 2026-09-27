"use client";
import { useSyncExternalStore } from "react";
import { awstCalendarDay, awstCalendarDayOffset } from "@/lib/caring-contacts/clock";
import { formatDayMonthYear } from "@/lib/first-nations/contact-format";

const subscribe = (notify: () => void) => {
  const timer = window.setInterval(notify, 60_000);
  return () => window.clearInterval(timer);
};

/** Recheck dates describe the evidence, not when a page was opened or printed. */
export function ContactReviewLine({ checkedAt, days = 90 }: { checkedAt: string; days?: number }) {
  const today = useSyncExternalStore(
    subscribe,
    () => awstCalendarDay(new Date()),
    () => null,
  );
  const due = awstCalendarDayOffset(checkedAt, days);
  return (
    <p className="text-2xs text-[color:var(--text-muted)]">
      {today && today > due
        ? "Due for a check · confirm details with the official source"
        : `Recheck by ${formatDayMonthYear(due)}`}
    </p>
  );
}
