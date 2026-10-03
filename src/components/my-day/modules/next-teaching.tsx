"use client";

import { formatModeTime } from "@/components/mode-kit/dates";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { perthDateKey, shortDayLabel } from "@/components/teaching/teaching-dates";
import type { SessionSummaryRead } from "@/components/teaching/teaching-reads";
import { sessionHref } from "@/components/teaching/teaching-view-model";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";

/**
 * The reader's next teaching session, from Teaching's own `view=next-session`
 * read. Renders nothing while loading, with no session ahead, or on any failure.
 */
export function MyDayNextTeaching() {
  const { status, data } = useTeachingResource<{ session: SessionSummaryRead | null }>(
    "/api/teaching?view=next-session",
  );
  const session = status === "ready" ? (data?.session ?? null) : null;
  if (!session || session.status === "cancelled") return null;
  const day = shortDayLabel(perthDateKey(session.startsAt));
  const when = session.allDay ? day : `${day} · ${formatModeTime(session.startsAt)}`;
  return (
    <ModeGroupedList eyebrow="Next teaching session" testId="my-day-module-teaching">
      <ModeRow
        title={session.title}
        subtitle={[when, session.venue].filter(Boolean).join(" · ")}
        href={sessionHref(session) ?? undefined}
        testId="my-day-module-teaching-row"
      />
    </ModeGroupedList>
  );
}
