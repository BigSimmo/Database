"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { useAccountData } from "@/components/account-data-provider";
import { AdminCredentialsWallet } from "@/components/admin/admin-credentials-wallet";
import { AdminPinnedNumbers } from "@/components/admin/admin-pinned-numbers";
import { AdminSetupSheet } from "@/components/admin/admin-setup-sheet";
import { TodayAtAGlance } from "@/components/admin/today/today-at-a-glance";
import { TodayComingUpModule } from "@/components/admin/today/today-coming-up-module";
import { TodayNeedsYouModule } from "@/components/admin/today/today-needs-you-module";
import { TodayNewJobModule } from "@/components/admin/today/today-new-job-module";
import { TodayRenewNextCard } from "@/components/admin/today/today-renew-next-card";
import { TodayRequirementsModule } from "@/components/admin/today/today-requirements-module";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { AdminLoadFailed } from "@/components/admin/admin-load-failed";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";
import { adminLoadState, selectAdminOwnEntries, selectAdminSharedEntries } from "@/lib/admin/own-entries";
import { buildAdminHelpItems } from "@/lib/admin/help-items";
import { formatDateEcho } from "@/lib/admin/renewal-dates";
import { renewalsShowCounts } from "@/lib/admin/renewals-filters";
import { needsSetup } from "@/lib/admin/setup";
import { selectNewJobProgress } from "@/lib/admin/new-job-progress";
import {
  selectComingUp,
  selectNeedsYou,
  selectRenewNext,
  selectRequirementsSummary,
} from "@/lib/admin/today-selectors";
import { perthHour } from "@/lib/clock-time";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { cacheOnCallEntries, readCachedOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { msUntilNextOnCallLocalDay } from "@/lib/on-call/local-date";

/**
 * Today (mode id `my-work`), the owner-approved order (plan-update-1, plus
 * the approved Admin proposal's features 2 and 3): a quiet greeting, the
 * "Renew next" answer card, "At a glance" counts, "Needs you", "Coming up",
 * "Requirements" in words, and — only once the owner has set a start date —
 * New job progress. Nothing else renders here: no Pay, no Help block, no ask
 * box (those live on their own Admin pages). Today has no tabs.
 *
 * Phone is one column in exactly that order. From `lg` the page splits into
 * two columns — what to act on (Renew next, At a glance, Needs you) on the
 * left, what is ahead (Coming up, Requirements, New job) on the right — and
 * the content is capped so cards never stretch across a wide screen. The
 * left column followed by the right column IS the phone order, so the two
 * layouts can never disagree about sequence.
 */
const TODAY_WIDTH = "mx-auto grid w-full max-w-2xl gap-5 sm:gap-6 lg:max-w-5xl";
const TODAY_COLUMNS = "grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start";
const TODAY_COLUMN = "grid min-w-0 content-start gap-5";

/**
 * The loading shape mirrors the ready layout — the Renew next card, the row of
 * three counts, then Needs you and Coming up — so nothing jumps when the
 * records arrive. Static grey, no shimmer (mode standard §7).
 */
function TodayLoadingSkeleton() {
  return (
    <div className={TODAY_COLUMNS} data-testid="admin-today-loading" aria-hidden="true">
      <div className={TODAY_COLUMN}>
        <ModeModuleSkeleton rows={3} twoLine eyebrow testId="admin-today-loading-renew-next" />
        <div className="grid grid-cols-3 gap-2" data-testid="admin-today-loading-at-a-glance">
          {[0, 1, 2].map((index) => (
            <div key={index} className={cn(modeModuleSurface, "grid h-17 content-between px-3 py-2")}>
              <span className="h-6 w-6 rounded-sm bg-[color:var(--surface-subtle)]" />
              <span className="h-3 w-3/4 rounded-sm bg-[color:var(--surface-subtle)]" />
            </div>
          ))}
        </div>
        <ModeModuleSkeleton rows={2} twoLine eyebrow testId="admin-today-loading-needs-you" />
      </div>
      <div className={TODAY_COLUMN}>
        <ModeModuleSkeleton rows={4} twoLine eyebrow testId="admin-today-loading-coming-up" />
      </div>
    </div>
  );
}
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
  const showCounts = useMemo(() => renewalsShowCounts(own, now), [own, now]);
  const comingUp = useMemo(() => selectComingUp(own, now), [own, now]);

  // This page view only — nothing is written to the device (spec review 5).
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const setupOpen = isAuthenticated && load === "ready" && !state.demoMode && !setupDismissed && needsSetup(own);

  // Pinned numbers (owner decision 2026-10-01): the same rows Help lists, so a pin made there shows here.
  const helpItems = useMemo(() => buildAdminHelpItems({ own, shared, statewide: [] }), [own, shared]);

  function upsert(entry: OnCallEntry) {
    const latest = readCachedOnCallEntries()?.entries ?? state.entries;
    cacheOnCallEntries([...latest.filter((existing) => existing.id !== entry.id), entry]);
  }

  return (
    <InformationPageShell testId="admin-today-main">
      <div className={TODAY_WIDTH}>
        <header data-testid="admin-today-greeting" className="grid gap-0.5">
          <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">{greetingFor(now)}</h1>
          <p className="text-sm text-[color:var(--text-muted)]">{formatDateEcho(today)}</p>
        </header>

        {load === "loading" ? <TodayLoadingSkeleton /> : null}

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
          <div className={TODAY_COLUMNS} data-testid="admin-today-ready">
            <div className={TODAY_COLUMN} data-testid="admin-today-column-act">
              {renewNext ? <TodayRenewNextCard item={renewNext} ownEntries={own} today={today} /> : null}
              {isAuthenticated && !state.demoMode ? <AdminCredentialsWallet /> : null}
              <TodayAtAGlance counts={showCounts} />
              <AdminPinnedNumbers items={helpItems} testId="admin-today-pinned" />
              {needsYou ? <TodayNeedsYouModule needsYou={needsYou} today={today} /> : null}
            </div>
            <div className={TODAY_COLUMN} data-testid="admin-today-column-ahead">
              <TodayComingUpModule comingUp={comingUp} today={today} />
              <TodayRequirementsModule summary={requirementsSummary} />
              {newJobProgress ? <TodayNewJobModule progress={newJobProgress} today={today} /> : null}
            </div>
          </div>
        ) : null}
      </div>

      <AdminSetupSheet
        open={setupOpen}
        onClose={() => setSetupDismissed(true)}
        existingEntries={own}
        onCreated={upsert}
      />
    </InformationPageShell>
  );
}
