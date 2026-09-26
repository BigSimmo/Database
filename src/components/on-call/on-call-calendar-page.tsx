"use client";

import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

import { CalendarSubscribe } from "@/components/calendar/calendar-subscribe";
import { CalendarView } from "@/components/calendar/calendar-view";
import { InformationPageShell } from "@/components/information-page-shell";
import { OnCallLoadFailed } from "@/components/on-call/on-call-load-failed";
import { OnCallToolNavHeader } from "@/components/on-call/on-call-nav-header";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, textMuted } from "@/components/ui-primitives";
import { onCallCalendarEvents } from "@/lib/on-call/calendar-events";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { onCallLocalDateKey } from "@/lib/on-call/local-date";

/**
 * CALENDAR — teaching sessions and recorded expiry dates on one month view,
 * each of which can go into the reader's own calendar.
 */
export function OnCallCalendarPage({ now: nowProp }: { now?: Date } = {}) {
  const { entries, loading, isOffline, loadError, retry, cachedAt } = useOnCallEntries();
  const mountedAt = useMemo(() => new Date(), []);
  const today = onCallLocalDateKey(nowProp ?? mountedAt);
  const events = useMemo(() => onCallCalendarEvents(entries, today), [entries, today]);

  return (
    <>
      <OnCallToolNavHeader title="Calendar" testIdPrefix="on-call-calendar" />
      <InformationPageShell testId="on-call-calendar-main" width="narrow">
        <h1 className="sr-only">Calendar</h1>
        <p className={cn(textMuted, "mb-4 text-sm")}>
          Teaching sessions, and the expiry dates you recorded on Compliance.
        </p>
        {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} reason={loadError} /> : null}
        {loading && entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Loading your calendar"
            body="Fetching sessions and dates."
            testId="on-call-calendar-loading"
          />
        ) : isOffline && entries.length === 0 ? (
          <OnCallLoadFailed reason={loadError} onRetry={retry} />
        ) : (
          <CalendarView events={events} today={today} exportName="On Call" testId="on-call-calendar-view" />
        )}
        <CalendarSubscribe testId="on-call-calendar-subscribe" />
      </InformationPageShell>
    </>
  );
}
