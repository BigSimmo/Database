import type { CalendarEvent } from "@/lib/calendar/calendar-event";
import type { SessionSummary } from "@/lib/teaching/model";
import { perthDate, perthTime } from "@/lib/teaching/time";

/**
 * Teaching sessions as calendar events for the private calendar link. Title, Perth time and
 * place only: never the join link, the presenter or anyone's attendance, because anyone holding
 * the link can read the feed.
 *
 * A cancelled session stays in the feed so subscribed calendars update it. It is marked
 * cancelled, its title says so in words (Google Calendar does not reliably honour STATUS:CANCELLED
 * in a subscribed feed), and it never carries a reminder. A moved session keeps its id, so
 * calendars move it rather than add a second copy.
 *
 * Relocated On Call sessions are left to `onCallTeachingEvents`, which keeps their ids.
 */
export function teachingCalendarEvents(sessions: readonly SessionSummary[]): CalendarEvent[] {
  return sessions.flatMap((session): CalendarEvent[] => {
    if (session.source !== "teaching") return [];
    const cancelled = session.status === "cancelled";
    const minutes = Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
    return [
      {
        id: `teaching-${session.occurrenceId}`,
        title: cancelled ? `Cancelled: ${session.title}` : session.title,
        date: perthDate(session.startsAt),
        startTime: perthTime(session.startsAt),
        durationMinutes: minutes > 0 ? minutes : 60,
        kind: "teaching",
        ...(cancelled ? { status: "cancelled" as const } : { reminderType: "teaching" as const }),
        location: session.venue ?? undefined,
        href: `/teaching/session/${session.occurrenceId}`,
      },
    ];
  });
}
