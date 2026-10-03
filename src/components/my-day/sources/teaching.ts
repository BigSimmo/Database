"use client";

import { useCallback, useMemo } from "react";

import { nextPresentedSession, presenterPrep } from "@/components/teaching/teaching-presenter-prep";
import { withUnit } from "@/components/teaching/teaching-number";
import { useTeachingResource, type TeachingResourceStatus } from "@/components/teaching/use-teaching-resource";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { myDaySeverityForDue } from "@/lib/my-day/merge";
import type { MyDayItem, MyDaySourceResult, MyDaySourceStatus } from "@/lib/my-day/model";
import {
  DEFAULT_REMINDER_SETTINGS,
  perthDateKey,
  showsReminderInApp,
  type ReminderSettings,
} from "@/lib/reminders/settings";
import type { SessionRef, TeachRead } from "@/lib/teaching/depth-model";

/**
 * Teaching's "Needs you" rows, read the way `teaching-needs-you.tsx` reads them
 * (three counts-only GETs) and worded by the same code. Demo mode is handled by
 * the API routes themselves; the signed-out sample path is deliberately unused.
 *
 * Deliberate decision: My Day gates Teaching items on the "teaching" reminder,
 * unlike Teaching's own page, which always shows its "Needs you" rows. My Day
 * is a nudge surface, so the reader's reminder choice decides whether it nudges.
 */

export interface TeachingMyDayInput {
  readonly unloggedCount: number | null;
  readonly teach: TeachRead | null;
  readonly feedbackOpen: { readonly sessions: readonly SessionRef[] } | null;
}

export function teachingMyDayItems(
  input: TeachingMyDayInput,
  now: Date,
  reminders: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
): MyDayItem[] {
  const today = perthDateKey(now);
  if (!showsReminderInApp(reminders, "teaching", today)) return [];
  const items: MyDayItem[] = [];

  const unlogged = input.unloggedCount ?? 0;
  if (unlogged > 0) {
    items.push({
      id: "teaching:review",
      mode: "teaching",
      title: `Review & log ${withUnit(unlogged, unlogged === 1 ? "session" : "sessions")}`,
      detail: "Attended, not yet in your CPD log",
      due: null,
      severity: "info",
      href: "/teaching/review",
    });
  }

  const prep = input.teach ? presenterPrep(input.teach, today) : null;
  const session = input.teach && prep ? nextPresentedSession(input.teach, today) : undefined;
  // Prep is a nudge to get ready, never an overdue failure: cap at "soon".
  if (prep && session) {
    items.push({
      id: `teaching:prep:${session.occurrenceId}`,
      mode: "teaching",
      title: prep.title,
      detail: prep.subtitle,
      due: session.startsAt,
      severity: myDaySeverityForDue(session.startsAt, now) === "info" ? "info" : "soon",
      href: "/teaching/teach",
    });
  }

  const feedback = input.feedbackOpen?.sessions.length ?? 0;
  if (feedback > 0) {
    items.push({
      id: "teaching:feedback",
      mode: "teaching",
      title: `Give feedback on ${withUnit(feedback, feedback === 1 ? "session" : "sessions")}`,
      detail: "Taps only, open for 7 days",
      due: null,
      severity: "info",
      href: "/teaching/feedback",
    });
  }
  return items;
}

function combine(statuses: readonly TeachingResourceStatus[]): MyDaySourceStatus {
  if (statuses.includes("signed-out")) return "signed-out";
  if (statuses.some((status) => status === "offline" || status === "error")) return "failed";
  if (statuses.includes("setup")) return "unavailable";
  if (statuses.some((status) => status === "loading" || status === "idle")) return "loading";
  return "ready";
}

export function useTeachingMyDaySource({ enabled, now }: { enabled: boolean; now: Date }): {
  result: MyDaySourceResult;
  retry: () => void;
} {
  const unlogged = useTeachingResource<{ count: number }>(enabled ? "/api/teaching?view=unlogged-count" : null);
  const teach = useTeachingResource<TeachRead>(enabled ? "/api/teaching/depth?view=teach" : null);
  const feedback = useTeachingResource<{ sessions: SessionRef[] }>(
    enabled ? "/api/teaching/depth?view=feedback-open" : null,
  );
  const { preferences } = useAppPreferences();
  const reminders = preferences.reminders;

  const status: MyDaySourceStatus = enabled ? combine([unlogged.status, teach.status, feedback.status]) : "signed-out";
  const unloggedCount = unlogged.data?.count ?? null;
  const teachData = teach.data;
  const feedbackData = feedback.data;
  const items = useMemo(
    () =>
      status === "ready"
        ? teachingMyDayItems({ unloggedCount, teach: teachData, feedbackOpen: feedbackData }, now, reminders)
        : [],
    [status, unloggedCount, teachData, feedbackData, now, reminders],
  );
  const result = useMemo<MyDaySourceResult>(() => ({ mode: "teaching", status, items }), [status, items]);

  const retryUnlogged = unlogged.retry;
  const retryTeach = teach.retry;
  const retryFeedback = feedback.retry;
  const retry = useCallback(() => {
    retryUnlogged();
    retryTeach();
    retryFeedback();
  }, [retryUnlogged, retryTeach, retryFeedback]);
  return { result, retry };
}
