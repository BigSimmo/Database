"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { useAccountData } from "@/components/account-data-provider";
import { AdminSetupSheet } from "@/components/admin/admin-setup-sheet";
import { TodayNeedsYouModule } from "@/components/admin/today/today-needs-you-module";
import { TodayNewJobModule } from "@/components/admin/today/today-new-job-module";
import { TodayRenewNextCard } from "@/components/admin/today/today-renew-next-card";
import { TodayRequirementsModule } from "@/components/admin/today/today-requirements-module";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { AdminLoadFailed } from "@/components/admin/admin-load-failed";
import { Button } from "@/components/ui/button";
import { adminLoadState, selectAdminOwnEntries, selectAdminSharedEntries } from "@/lib/admin/own-entries";
import { formatDateEcho } from "@/lib/admin/renewal-dates";
import { needsSetup } from "@/lib/admin/setup";
import { selectNewJobProgress } from "@/lib/admin/new-job-progress";
import { selectNeedsYou, selectRenewNext, selectRequirementsSummary } from "@/lib/admin/today-selectors";
import { perthHour } from "@/lib/clock-time";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { cacheOnCallEntries, readCachedOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { msUntilNextOnCallLocalDay } from "@/lib/on-call/local-date";

/**
 * Today (mode id `my-work`), the owner-approved order (plan-update-1): a
 * quiet greeting, the "Renew next" answer card, "Needs you", "Requirements"
 * in words, and — only once the owner has set a start date — New job
 * progress. Nothing else renders here: no timeline, no Pay, no Help block, no
 * ask box (those live on their own Admin pages). Today has no tabs.
 */
function greetingFor(now: Date): string {
  const hour = perthHour(now);
  return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
}

export function AdminTodayPage({ now: nowProp }: { now?: Date } = {}) {
  const state = useOnCallEntries();
  const { isAuthenticated } = useAccountData();
  const [tick, setTick] = useState(() => new Date());
  const now = nowProp ?? tick;
  useEffect(() => {
    if (nowProp) return;
    const timer = setTimeout(() => setTick(new Date()), msUntilNextOnCallLocalDay(now));
    return () => clearTimeout(timer);
  }, [nowProp, now]);
  const today = perthCalendarDate(now);
  const load = adminLoadState(state);

  const own = useMemo(() => selectAdminOwnEntries(state), [state]);
  const shared = useMemo(() => selectAdminSharedEntries(state), [state]);
  const newJobProgress = useMemo(() => selectNewJobProgress({ own, shared }, now), [own, shared, now]);
  const renewNext = useMemo(() => selectRenewNext(own, newJobProgress?.startsOn, now), [own, newJobProgress, now]);
  const excludeEntryId = renewNext?.kind === "compliance" ? renewNext.entry?.id : undefined;
  const needsYou = useMemo(() => selectNeedsYou(own, now, { excludeEntryId }), [own, now, excludeEntryId]);
  const requirementsSummary = useMemo(() => selectRequirementsSummary(own), [own]);

  // This page view only — nothing is written to the device (spec review 5).
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const setupOpen = isAuthenticated && load === "ready" && !state.demoMode && !setupDismissed && needsSetup(own);

  function upsert(entry: OnCallEntry) {
    const latest = readCachedOnCallEntries()?.entries ?? state.entries;
    cacheOnCallEntries([...latest.filter((existing) => existing.id !== entry.id), entry]);
  }

  return (
    <InformationPageShell testId="admin-today-main">
      <header data-testid="admin-today-greeting" className="grid gap-0.5">
        <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">{greetingFor(now)}</h1>
        <p className="text-sm text-[color:var(--text-muted)]">{formatDateEcho(today)}</p>
      </header>

      {load === "loading" ? (
        <div className="grid gap-5" data-testid="admin-today-loading">
          <ModeModuleSkeleton rows={4} twoLine eyebrow />
          <ModeModuleSkeleton rows={3} twoLine eyebrow />
          <ModeModuleSkeleton rows={1} twoLine eyebrow />
        </div>
      ) : null}

      {load === "failed" ? (
        <AdminLoadFailed reason={state.loadError} onRetry={state.retry} testId="admin-today-load-failed" />
      ) : null}

      {load === "signed-out" ? (
        <div className="grid gap-3" data-testid="admin-today-signed-out">
          <EmptyState
            icon={LogIn}
            title="Sign in to see your records"
            body="Linked to your account only, not shared with your health service."
            actions={
              <Button variant="primary" onClick={() => setSignInOpen(true)}>
                Sign in
              </Button>
            }
          />
          <Link
            href="/admin/help"
            className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-medium text-[color:var(--text-heading)] no-underline"
          >
            Help — Crisis lines and contacts
          </Link>
          <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
      ) : null}

      {load === "ready" ? (
        <div className="grid gap-5">
          {renewNext ? <TodayRenewNextCard item={renewNext} ownEntries={own} today={today} /> : null}
          {needsYou ? <TodayNeedsYouModule needsYou={needsYou} today={today} /> : null}
          <TodayRequirementsModule summary={requirementsSummary} />
          {newJobProgress ? <TodayNewJobModule progress={newJobProgress} today={today} /> : null}
        </div>
      ) : null}

      <AdminSetupSheet
        open={setupOpen}
        onClose={() => setSetupDismissed(true)}
        existingEntries={own}
        onCreated={upsert}
      />
    </InformationPageShell>
  );
}
