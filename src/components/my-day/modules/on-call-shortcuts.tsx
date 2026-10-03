"use client";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";

/**
 * Two shortcuts into the On Call Call page, where the quick call log and the
 * ISBAR handover builder live (they have no routes of their own, so these
 * link to their headings). Static links; nothing is read or fetched.
 */
export function MyDayOnCallShortcuts() {
  return (
    <ModeGroupedList eyebrow="On shift" testId="my-day-module-on-call">
      <ModeRow
        title="Quick call log"
        subtitle="Note a call as it happens"
        href="/on-call/call#on-call-call-log-heading"
        testId="my-day-module-on-call-log"
      />
      <ModeRow
        title="Handover builder"
        subtitle="ISBAR handover for the next shift"
        href="/on-call/call#on-call-handover-heading"
        testId="my-day-module-on-call-handover"
      />
    </ModeGroupedList>
  );
}
