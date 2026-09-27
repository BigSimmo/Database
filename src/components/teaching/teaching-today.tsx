"use client";

import { useMemo, useState } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingCalendarSheet } from "@/components/teaching/teaching-calendar-sheet";
import { addDays, perthDateKey } from "@/components/teaching/teaching-dates";
import { TeachingHero } from "@/components/teaching/teaching-hero";
import { TeachingContextBar } from "@/components/teaching/teaching-modules";
import type { SessionSummaryRead } from "@/components/teaching/teaching-reads";
import { TeachingSignInNotice } from "@/components/teaching/teaching-sign-in";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import {
  ALL_TEAMS,
  heroModel,
  nextSession,
  restOfWeek,
  sessionHref,
  sessionsForTeam,
} from "@/components/teaching/teaching-view-model";
import { useSessionDetail } from "@/components/teaching/use-session-detail";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { useTeachingWeek, type TeachingWeekState } from "@/components/teaching/use-teaching-week";
import { teachingErrorMessage, teachingPost, teachingServiceUrl } from "@/lib/teaching/client";

/*
 * Today: the hero, then (U5) Needs you, then one row to Week. The page name is
 * the pill, so the h1 is sr-only. The hero is the next session in the coming
 * seven days across every service the reader is in; when nothing falls in
 * those seven days, `view=next-session` supplies it.
 */
export function TeachingToday({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const today = now ? perthDateKey(now) : null;
  const range = useMemo(() => (today ? { from: today, to: addDays(today, 6) } : null), [today]);
  const [signedOutDemo, setSignedOutDemo] = useState(false);
  const view = useTeachingWeek(range, { demoMode, signedOutDemo }, now);
  return (
    <InformationPageShell width="narrow" gap={false} testId="teaching-today">
      <div className="grid gap-3">
        <h1 className="sr-only">Today</h1>
        {now && today ? (
          <TodayBody view={view} now={now} today={today} onOpenDemo={() => setSignedOutDemo(true)} />
        ) : (
          <ModeModuleSkeleton rows={2} twoLine eyebrow />
        )}
      </div>
    </InformationPageShell>
  );
}

function TodayBody({
  view,
  now,
  today,
  onOpenDemo,
}: {
  view: TeachingWeekState;
  now: Date;
  today: string;
  onOpenDemo: () => void;
}) {
  const [team, setTeam] = useState(ALL_TEAMS);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const live = view.demo === "off";
  const week = view.status === "ready" ? view.week : null;
  const teamValue = week && (team === ALL_TEAMS || week.teams.some((t) => t.id === team)) ? team : ALL_TEAMS;
  const sessions = week ? sessionsForTeam([...week.sessions, ...week.relocated], teamValue) : [];
  const inRange = week ? nextSession(sessions, now) : null;
  // Every hook sits above the early returns.
  const later = useTeachingResource<{ session: SessionSummaryRead | null }>(
    week && live && !inRange && week.teams.length > 0 ? "/api/teaching?view=next-session" : null,
  );
  const laterSession = later.data?.session ?? null;
  const next = inRange ?? (teamValue === ALL_TEAMS || laterSession?.serviceId === teamValue ? laterSession : null);
  const wantsJoin =
    next !== null && next.hasJoinLink && sessionHref(next) !== null && perthDateKey(next.startsAt) === today;
  const detail = useSessionDetail(wantsJoin && next ? next.occurrenceId : null, !live, now);

  if (view.status === "signed-out") return <TeachingSignInNotice onOpenDemo={onOpenDemo} />;
  if (view.status === "offline" || view.status === "error" || view.status === "setup")
    return <TeachingStateNotice state={view.status} onRetry={view.retry} />;
  if (!week || (!inRange && later.status === "loading")) return <ModeModuleSkeleton rows={2} twoLine eyebrow />;
  if (week.teams.length === 0 && week.relocated.length === 0) return <TeachingStateNotice state="no-team" />;

  const bar = (
    <TeachingContextBar
      teams={week.teams}
      value={teamValue}
      onChange={setTeam}
      demoTag={!live || week.teams.some((t) => t.isDemo)}
    />
  );
  if (!next) {
    const chosen = week.teams.find((t) => t.id === teamValue) ?? (week.teams.length === 1 ? week.teams[0] : undefined);
    return (
      <>
        {bar}
        <TeachingStateNotice
          state="empty"
          serviceName={chosen?.name}
          onSwitchService={teamValue !== ALL_TEAMS ? () => setTeam(ALL_TEAMS) : undefined}
        />
      </>
    );
  }

  const hero = heroModel(next, {
    now,
    today,
    teams: week.teams,
    showTeam: teamValue === ALL_TEAMS && week.teams.length > 1,
    attendance: week.attendance,
    joinUrl: detail.data?.joinUrl ?? null,
    calendar: live,
    hadToday: sessions.some((s) => s.status !== "cancelled" && perthDateKey(s.startsAt) === today),
  });

  async function checkInWithoutCode() {
    if (!next) return;
    if (!live) {
      setSaveError("The demo doesn't save check-ins.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await teachingPost(teachingServiceUrl(next.serviceId), {
        action: "attendance.self",
        occurrenceId: next.occurrenceId,
      });
      view.retry();
    } catch (cause) {
      setSaveError(teachingErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const actions = hero.actions.map((action) =>
    action.id === "self"
      ? { ...action, onClick: () => void checkInWithoutCode(), busy: saving, busyLabel: "Saving" }
      : action.id === "calendar"
        ? { ...action, onClick: () => setCalendarOpen(true) }
        : action,
  );

  return (
    <>
      {bar}
      <TeachingHero {...hero} actions={actions} />
      {saveError ? <ModeNotice tone="warning">{saveError}</ModeNotice> : null}
      {/* U5 Step 9 inserts the Needs you module here. */}
      <ModeGroupedList testId="teaching-rest-of-week">
        <ModeRow
          href="/teaching/week"
          title="Rest of this week"
          subtitle={restOfWeek(sessions, next.occurrenceId, now, today)}
        />
      </ModeGroupedList>
      {live ? (
        <TeachingCalendarSheet
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          teams={week.teams}
          onChanged={view.retry}
        />
      ) : null}
    </>
  );
}
