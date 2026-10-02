"use client";

import { useId } from "react";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { RESOURCE_KIND_WORDS, resourceHref } from "@/components/teaching/resources-model";
import { perthDateKey, shortDayLabel, timeRange } from "@/components/teaching/teaching-dates";
import { TeachingRow } from "@/components/teaching/teaching-row";
import { sessionHref } from "@/components/teaching/teaching-view-model";
import type { TeachingResourceStatus } from "@/components/teaching/use-teaching-resource";
import { cn, eyebrowText } from "@/components/ui-primitives";
import type { ResourceRow, SessionSummary, TeachingWeek, TeachingWeekResponse } from "@/lib/teaching/model";

/*
 * Catch-up: this week's sessions that have ended with no check-in recorded, each with the
 * materials its presenter shared. Pure helpers first, so Today can count the same list without
 * rendering it. It never says "missed": the reader may have been there and not checked in.
 */
export type CatchUpItem = { session: SessionSummary; materials: ResourceRow[] };

type WeekSessions = Pick<TeachingWeek, "sessions" | "attendance">;

function endedWithoutMark(week: WeekSessions, now: Date): SessionSummary[] {
  const marked = new Set(week.attendance.map((mark) => mark.occurrenceId));
  const at = now.getTime();
  return week.sessions
    .filter(
      (session) =>
        session.status !== "cancelled" &&
        // A relocated On Call item has no Teaching page and no check-in, so nothing to catch up on.
        sessionHref(session) !== null &&
        Date.parse(session.endsAt) < at &&
        !marked.has(session.occurrenceId),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.occurrenceId.localeCompare(b.occurrenceId));
}

/** The week's ended, unmarked sessions, each paired with the resources shared for that occurrence. */
export function catchUpSessions(week: WeekSessions, resources: readonly ResourceRow[], now: Date): CatchUpItem[] {
  return endedWithoutMark(week, now).map((session) => ({
    session,
    materials: resources.filter((item) => item.occurrenceId === session.occurrenceId),
  }));
}

/** How many sessions the catch-up list would show. Sessions only; no resources needed. */
export function catchUpCount(week: TeachingWeekResponse | TeachingWeek, now: Date): number {
  return endedWithoutMark(week, now).length;
}

const UNAVAILABLE: readonly TeachingResourceStatus[] = ["error", "offline", "setup", "signed-out"];

function MaterialRow({ item }: { item: ResourceRow }) {
  const href = resourceHref(item);
  const subtitle = RESOURCE_KIND_WORDS[item.kind];
  if (href && item.libraryDocumentId) return <ModeRow title={item.title} subtitle={subtitle} href={href} />;
  if (href) return <TeachingRow title={item.title} subtitle={subtitle} externalHref={href} />;
  return <ModeRow title={item.title} subtitle={subtitle} />;
}

/**
 * The Resources page's first section (`#catch-up`, which Today links to). A failed week read shows a
 * quiet notice, never "nothing to catch up on", because an empty list there would be a false claim.
 */
export function TeachingCatchUp({
  status,
  week,
  resources,
  now,
}: {
  status: TeachingResourceStatus;
  week: WeekSessions | null;
  resources: readonly ResourceRow[];
  now: Date | null;
}) {
  const headingId = useId();
  let body;
  if (UNAVAILABLE.includes(status)) body = <ModeNotice>Catch-up list unavailable right now.</ModeNotice>;
  else if (status !== "ready" || !week || !now) body = <ModeModuleSkeleton rows={2} twoLine />;
  else {
    const items = catchUpSessions(week, resources, now);
    body =
      items.length === 0 ? (
        <ModeNotice>Nothing to catch up on this week.</ModeNotice>
      ) : (
        <ModeGroupedList mode="teaching" testId="teaching-catch-up-list">
          {items.flatMap(({ session, materials }) => [
            <ModeRow
              key={session.occurrenceId}
              title={session.title}
              subtitle={`${shortDayLabel(perthDateKey(session.startsAt))} · ${timeRange(session.startsAt, session.endsAt)}`}
              meta={<span className={cn(modeSecondaryText, "leading-5")}>No check-in recorded</span>}
              href={sessionHref(session) ?? undefined}
              testId={`teaching-catch-up-${session.occurrenceId}`}
            />,
            ...(materials.length > 0
              ? materials.map((item) => <MaterialRow key={`${session.occurrenceId}:${item.resourceId}`} item={item} />)
              : [
                  <ModeRow
                    key={`${session.occurrenceId}:none`}
                    title={<span className={modeSecondaryText}>No catch-up recording or slides yet.</span>}
                  />,
                ]),
          ])}
        </ModeGroupedList>
      );
  }
  return (
    <section
      id="catch-up"
      aria-labelledby={headingId}
      data-testid="teaching-catch-up"
      className="grid min-w-0 scroll-mt-4 gap-2"
    >
      <h2 id={headingId} className={cn(eyebrowText, "px-3")}>
        Catch up
      </h2>
      {body}
    </section>
  );
}
