"use client";

import { ChevronLeft, LogIn, Sunrise } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { MyDayDashboard, type MyDayDashboardProps } from "@/components/my-day/my-day-dashboard";
import { listNames, MyDayItemRow, myDayModeLabel, useMyDayNow } from "@/components/my-day/my-day-page-parts";
import { useMyDayDashboardSources } from "@/components/my-day/use-my-day-dashboard-sources";
import { useMyDayItems } from "@/components/my-day/use-my-day-items";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { formatDateEcho } from "@/lib/admin/renewal-dates";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import {
  myDayEnabledForAuth,
  myDayNeedsSignIn,
  myDaySourceModes,
  type MyDayItem,
  type MyDayState,
} from "@/lib/my-day/model";
import { useAuthSession } from "@/lib/supabase/client";

const PAGE_WIDTH = "mx-auto grid w-full max-w-2xl gap-5 sm:gap-6 lg:max-w-5xl";

/**
 * Invented sample data is shown only in a local demo build with no sign-in
 * configured. For a signed-in reader, any source that answered with sample
 * data contributes nothing, so no invented item is ever shown as theirs.
 */
function myDayShownItems(state: MyDayState, allowSample: boolean): readonly MyDayItem[] {
  if (allowSample) return state.items;
  const sampleModes = new Set(state.sources.filter((source) => source.sample === true).map((source) => source.mode));
  return sampleModes.size ? state.items.filter((item) => !sampleModes.has(item.mode)) : state.items;
}

/** The full list ("All N"): every item, grouped by urgency, as My Day first shipped it. */
function MyDayFullList({
  items,
  now,
  checked,
  onBack,
  onRetry,
}: {
  readonly items: readonly MyDayItem[];
  readonly now: Date;
  readonly checked: readonly string[];
  readonly onBack: () => void;
  readonly onRetry: () => void;
}) {
  const sections = [
    { key: "overdue", eyebrow: "Needs you now", items: items.filter((item) => item.severity === "overdue") },
    { key: "soon", eyebrow: "Due soon", items: items.filter((item) => item.severity === "soon") },
    { key: "later", eyebrow: "Later", items: items.filter((item) => item.severity === "info") },
  ].filter((section) => section.items.length > 0);
  return (
    <div className="grid gap-5" data-testid="my-day-full-list">
      <div>
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack} data-testid="my-day-back">
          Back to dashboard
        </Button>
      </div>
      {sections.length === 0 ? (
        <div data-testid="my-day-empty">
          {checked.length > 0 ? (
            <EmptyState icon={Sunrise} title="Nothing needs you right now" body={`Checked ${listNames(checked)}.`} />
          ) : (
            <EmptyState
              icon={Sunrise}
              title="Couldn't check your day"
              body="No source could be checked just now."
              actions={
                <Button variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              }
            />
          )}
        </div>
      ) : (
        sections.map((section) => (
          <ModeGroupedList key={section.key} eyebrow={section.eyebrow} testId={`my-day-section-${section.key}`}>
            {section.items.map((item) => (
              <MyDayItemRow key={item.id} item={item} now={now} />
            ))}
          </ModeGroupedList>
        ))
      )}
    </div>
  );
}

/** The dashboard's own reads, mounted only for an enabled reader and remounted per sign-in. */
function MyDayDashboardView({
  allowSample,
  ...props
}: Omit<MyDayDashboardProps, "sources"> & { readonly allowSample: boolean }) {
  const sources = useMyDayDashboardSources({ today: props.today, allowSample });
  return <MyDayDashboard {...props} sources={sources} />;
}

export function MyDayPage({ now: nowProp }: { now?: Date } = {}) {
  const { status: authStatus, authEpoch } = useAuthSession();
  const enabled = myDayEnabledForAuth(authStatus);
  // Only a local demo build with no sign-in may show invented examples.
  const allowSample = authStatus === "unconfigured";
  const now = useMyDayNow(nowProp);
  const today = perthCalendarDate(now);
  const state = useMyDayItems({ enabled, now });
  const [signInOpen, setSignInOpen] = useState(false);
  const [view, setView] = useState<"dashboard" | "all">("dashboard");
  const [editing, setEditing] = useState(false);

  const items = useMemo(() => myDayShownItems(state, allowSample), [state, allowSample]);
  const failed = state.sources
    .filter((source) => source.status === "failed")
    .map((source) => myDayModeLabel(source.mode));
  const rosterUnavailable = state.sources.some((source) => source.mode === "roster" && source.status === "unavailable");
  const otherUnavailable = state.sources
    .filter((source) => source.status === "unavailable" && source.mode !== "roster")
    .map((source) => myDayModeLabel(source.mode));
  const checked = myDaySourceModes
    .filter((mode) => state.sources.some((source) => source.mode === mode && source.status === "ready"))
    .map(myDayModeLabel);
  const myWorkSample = state.sources.some((source) => source.mode === "my-work" && source.sample === true);
  const nextRenewal = state.nextRenewal && (allowSample || !myWorkSample) ? state.nextRenewal : null;
  const ready = enabled && state.status === "ready";

  return (
    <InformationPageShell testId="my-day-main">
      <div className={PAGE_WIDTH}>
        <header className="flex min-w-0 items-end justify-between gap-3" data-testid="my-day-header">
          <div className="grid min-w-0 gap-0.5">
            <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">My Day</h1>
            <p className="text-sm text-[color:var(--text-muted)]">{formatDateEcho(today)}</p>
          </div>
          {ready && view === "dashboard" ? (
            <Button variant="ghost" onClick={() => setEditing((value) => !value)} data-testid="my-day-edit">
              {editing ? "Done" : "Edit"}
            </Button>
          ) : null}
        </header>

        {authStatus === "loading" || (enabled && state.status === "loading") ? (
          <>
            <span role="status" className="sr-only">
              Loading My Day
            </span>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="my-day-loading" aria-hidden="true">
              <div className="col-span-2">
                <ModeModuleSkeleton rows={2} twoLine eyebrow />
              </div>
              <ModeModuleSkeleton rows={2} eyebrow />
              <ModeModuleSkeleton rows={2} eyebrow />
              <div className="col-span-2">
                <ModeModuleSkeleton rows={3} twoLine eyebrow />
              </div>
            </div>
          </>
        ) : null}

        {authStatus === "error" ? (
          <div className="grid gap-2" data-testid="my-day-auth-error">
            <ModeNotice tone="warning">Couldn&apos;t check your sign-in. Try again.</ModeNotice>
            <div>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {myDayNeedsSignIn(authStatus) ? (
          <div className="grid gap-3" data-testid="my-day-signed-out">
            <EmptyState
              icon={LogIn}
              title="Sign in to see your day"
              body="My Day gathers your own On Call, Roster, CPD, Teaching and Admin records. Nothing is shared."
              actions={
                <Button variant="primary" onClick={() => setSignInOpen(true)}>
                  Sign in
                </Button>
              }
            />
            <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
          </div>
        ) : null}

        {ready ? (
          <div className="grid gap-5" data-testid="my-day-ready">
            {allowSample && state.demoMode ? (
              <ModeNotice testId="my-day-demo-notice">Demo data: these items are invented examples.</ModeNotice>
            ) : null}
            {failed.length > 0 ? (
              <div className="grid gap-2" data-testid="my-day-failed-notice">
                <ModeNotice tone="warning">{`Couldn't load: ${failed.join(", ")}.${checked.length > 0 ? " Showing the rest." : ""}`}</ModeNotice>
                {checked.length > 0 ? (
                  <div>
                    <Button variant="secondary" onClick={state.retry}>
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {rosterUnavailable ? (
              <ModeNotice testId="my-day-unavailable-notice">
                Roster team data isn&apos;t available yet, so swaps aren&apos;t shown.
              </ModeNotice>
            ) : null}
            {otherUnavailable.length > 0 ? (
              <ModeNotice testId="my-day-unavailable-other-notice">
                {`${listNames(otherUnavailable)} isn't available yet, so it isn't shown.`}
              </ModeNotice>
            ) : null}

            {view === "all" ? (
              <MyDayFullList
                items={items}
                now={now}
                checked={checked}
                onBack={() => setView("dashboard")}
                onRetry={state.retry}
              />
            ) : (
              <MyDayDashboardView
                key={authEpoch}
                allowSample={allowSample}
                now={now}
                today={today}
                items={items}
                nextRenewal={nextRenewal}
                checked={checked}
                editing={editing}
                onShowAll={() => {
                  setEditing(false);
                  setView("all");
                }}
                onRetry={state.retry}
              />
            )}

            <p className="px-3 text-sm text-[color:var(--text-muted)]" data-testid="my-day-footer">
              Read-only. Open an item to act on it in its own mode. Later and Edit are kept on this device only.
            </p>
          </div>
        ) : null}
      </div>
    </InformationPageShell>
  );
}
