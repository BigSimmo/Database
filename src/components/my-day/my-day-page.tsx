"use client";

import { CircleCheck, LogIn } from "lucide-react";
import { useEffect, useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { useMyDayItems } from "@/components/my-day/use-my-day-items";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";
import { formatDateEcho } from "@/lib/admin/renewal-dates";
import { appModeDefinition } from "@/lib/app-modes";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { formatMyDayDue } from "@/lib/my-day/merge";
import { myDaySourceModes, type MyDayItem, type MyDaySourceMode } from "@/lib/my-day/model";

const PAGE_WIDTH = "mx-auto grid w-full max-w-2xl gap-5 sm:gap-6";
const TICK_MS = 60_000;

/** The reader's clock, re-read every minute so "Today · 14:30" stays honest and the day rolls over. */
export function useMyDayNow(nowProp?: Date): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (nowProp) return;
    const timer = setInterval(() => setTick(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [nowProp]);
  return nowProp ?? tick;
}

function modeLabel(mode: MyDaySourceMode): string {
  return appModeDefinition(mode).label;
}

/** One My Day row, shared by the page and the home card. */
export function MyDayItemRow({ item, now }: { readonly item: MyDayItem; readonly now: Date }) {
  const due = formatMyDayDue(item.due, now);
  const subtitle = due ? `${modeLabel(item.mode)} · ${due}` : modeLabel(item.mode);
  return (
    <ModeRow
      title={item.title}
      subtitle={subtitle}
      meta={
        item.detail ? <span className={cn(modeSecondaryText, "break-words leading-5")}>{item.detail}</span> : undefined
      }
      href={item.href}
      testId={`my-day-item-${item.id}`}
      trailing={
        item.severity === "overdue" ? (
          <ModeStateLabel tone="warning">Overdue</ModeStateLabel>
        ) : item.severity === "soon" ? (
          <ModeStateLabel>Due soon</ModeStateLabel>
        ) : undefined
      }
    />
  );
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function MyDayPage({ now: nowProp }: { now?: Date } = {}) {
  const { isAuthenticated } = useAccountData();
  const now = useMyDayNow(nowProp);
  const state = useMyDayItems({ enabled: isAuthenticated, now });
  const [signInOpen, setSignInOpen] = useState(false);

  const failed = state.sources.filter((source) => source.status === "failed").map((source) => modeLabel(source.mode));
  const rosterUnavailable = state.sources.some((source) => source.mode === "roster" && source.status === "unavailable");
  const otherUnavailable = state.sources
    .filter((source) => source.status === "unavailable" && source.mode !== "roster")
    .map((source) => modeLabel(source.mode));
  const checked = myDaySourceModes
    .filter((mode) => state.sources.some((source) => source.mode === mode && source.status === "ready"))
    .map(modeLabel);

  const sections = [
    { key: "overdue", eyebrow: "Overdue", items: state.items.filter((item) => item.severity === "overdue") },
    { key: "soon", eyebrow: "Due soon", items: state.items.filter((item) => item.severity === "soon") },
    { key: "later", eyebrow: "Later", items: state.items.filter((item) => item.severity === "info") },
  ].filter((section) => section.items.length > 0);

  return (
    <InformationPageShell testId="my-day-main">
      <div className={PAGE_WIDTH}>
        <header className="grid gap-0.5" data-testid="my-day-header">
          <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">My Day</h1>
          <p className="text-sm text-[color:var(--text-muted)]">{formatDateEcho(perthCalendarDate(now))}</p>
        </header>

        {state.status === "loading" ? (
          <div className="grid gap-5" data-testid="my-day-loading" aria-hidden="true">
            <ModeModuleSkeleton rows={3} twoLine eyebrow />
            <ModeModuleSkeleton rows={2} twoLine eyebrow />
          </div>
        ) : null}

        {state.status === "signed-out" ? (
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

        {state.status === "ready" ? (
          <div className="grid gap-5" data-testid="my-day-ready">
            {state.demoMode ? (
              <ModeNotice testId="my-day-demo-notice">Demo data: these items are invented examples.</ModeNotice>
            ) : null}
            {failed.length > 0 ? (
              <div className="grid gap-2" data-testid="my-day-failed-notice">
                <ModeNotice>{`Couldn't load: ${failed.join(", ")}. Showing the rest.`}</ModeNotice>
                <div>
                  <Button variant="secondary" onClick={state.retry}>
                    Retry
                  </Button>
                </div>
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

            {sections.length === 0 ? (
              <div data-testid="my-day-empty">
                <EmptyState
                  icon={CircleCheck}
                  title="Nothing needs you right now"
                  body={checked.length > 0 ? `Checked ${listNames(checked)}.` : "No source could be checked just now."}
                />
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

            <p className="px-3 text-sm text-[color:var(--text-muted)]" data-testid="my-day-footer">
              Read-only. Open an item to act on it in its own mode.
            </p>
          </div>
        ) : null}
      </div>
    </InformationPageShell>
  );
}
