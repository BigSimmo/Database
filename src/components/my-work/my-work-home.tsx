"use client";

import { BellRing, CalendarCheck, CalendarDays, ChevronRight, Clock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import {
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
  ON_CALL_VIEW_HREFS,
  ON_CALL_VIEW_ICONS,
  ON_CALL_VIEW_TITLES,
} from "@/components/on-call/on-call-section-identity";
import { PageHeader } from "@/components/ui/page-header";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { complianceExpiresOn, partitionLogisticsEntries } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { onCallLocalDateKey } from "@/lib/on-call/local-date";
import { buildOnCallReviewQueue, ON_CALL_DUE_SOON_DAYS } from "@/lib/on-call/review-queue";
import { onCallTeachingDateParts } from "@/lib/on-call/teaching-schedule";
import { sharedHomePresentation } from "@/lib/ui-copy";

/**
 * MY WORK — the paperwork, deadlines and checks that used to crowd On Call.
 *
 * A dashboard over pages that keep their own addresses, so every saved link
 * and bookmark still works: What's next first, then one card per page. It adds
 * no data of its own; everything here is read from the owner's On Call entries.
 *
 * The compliance rows follow `src/lib/on-call/compliance.ts`, "What this page
 * may never say": they report the date the owner recorded, never a verdict on
 * the owner's standing. `tests/on-call-compliance.test.ts` scans this file.
 */

const DAY_MS = 86_400_000;

type NextItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
};

/** `YYYY-MM-DD` as "12 Mar 2027", the way the Compliance page prints it. */
function formatRecordedDate(date: string): string {
  const { day, month, year } = onCallTeachingDateParts(date);
  if (!day || !month) return date;
  return `${day} ${month} ${year}`;
}

/**
 * Compliance rows whose recorded date falls in the next thirty days or has
 * already passed, soonest first. A row with no recorded date is left out: it
 * cannot be shown as due.
 */
export function selectComplianceDueSoon(entries: readonly OnCallEntry[], now: Date): OnCallEntry[] {
  const horizon = onCallLocalDateKey(new Date(now.getTime() + ON_CALL_DUE_SOON_DAYS * DAY_MS));
  return partitionLogisticsEntries(entries)
    .compliance.filter((entry) => {
      const expiresOn = complianceExpiresOn(entry);
      return expiresOn !== undefined && expiresOn <= horizon;
    })
    .sort(
      (a, b) =>
        (complianceExpiresOn(a) ?? "").localeCompare(complianceExpiresOn(b) ?? "") || a.title.localeCompare(b.title),
    );
}

const pageCard = cn(
  cardSurface,
  cardPadding.compact,
  focusRing,
  "flex min-h-12 items-start gap-3 no-underline",
  "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
);

/** The inside of one page card. The `<Link>` around it is written out per page
 *  with a literal `href`, so `tests/route-reachability.test.ts` can see each
 *  route is linked. */
function PageCardBody({
  icon: PageIcon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <PageIcon aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
        <span className={cn(textMuted, "text-xs")}>{description}</span>
      </span>
    </>
  );
}

export function MyWorkHome({ now: nowProp }: { now?: Date } = {}) {
  const presentation = sharedHomePresentation["my-work"];
  const { entries, loading, isOffline, signedOut } = useOnCallEntries();
  const mountedAt = useMemo(() => new Date(), []);
  const now = nowProp ?? mountedAt;

  const nextItems = useMemo<NextItem[]>(() => {
    const items: NextItem[] = selectComplianceDueSoon(entries, now).map((entry) => {
      const expiresOn = complianceExpiresOn(entry) ?? "";
      const passed = expiresOn < onCallLocalDateKey(now);
      return {
        key: `compliance-${entry.id}`,
        href: ON_CALL_VIEW_HREFS.compliance,
        icon: ON_CALL_VIEW_ICONS.compliance,
        title: entry.title,
        detail: `Recorded as expiring ${formatRecordedDate(expiresOn)}${passed ? " — that date has passed" : ""}`,
      };
    });
    const queue = buildOnCallReviewQueue(entries, now);
    if (queue.total > 0) {
      items.push({
        key: "check",
        href: "/on-call/check",
        icon: CalendarCheck,
        title: `${queue.total} ${queue.total === 1 ? "entry" : "entries"} due a check`,
        detail: `Never checked, past twelve months, or due in the next ${ON_CALL_DUE_SOON_DAYS} days`,
      });
    }
    return items;
  }, [entries, now]);

  // A short list is only good news when entries were actually loaded. Loading,
  // a failed load, a signed-out reader and an empty account all produce an
  // empty list too, and none of them may read as "nothing due".
  const hasEntries = entries.length > 0;
  const emptyMessage = hasEntries
    ? `Nothing recorded as due in the next ${ON_CALL_DUE_SOON_DAYS} days.`
    : loading
      ? "Loading your entries."
      : isOffline
        ? "Your entries could not be loaded. Try again when you are back online."
        : signedOut
          ? "Sign in to see what is due."
          : "Nothing added yet. Admin and compliance items you add will show here when they fall due.";

  return (
    <InformationPageShell testId="my-work-home">
      <PageHeader title={presentation.title} description={presentation.subtitle} />

      <section aria-labelledby="my-work-next-heading" className="grid gap-2" data-testid="my-work-next">
        <h2 id="my-work-next-heading" className={eyebrowText}>
          What&apos;s next
        </h2>
        {nextItems.length === 0 ? (
          <p className={cn(cardSurface, cardPadding.compact, textMuted, "text-sm")} data-testid="my-work-next-empty">
            {emptyMessage}
          </p>
        ) : (
          <ul className="grid gap-1.5" aria-label="What's next">
            {nextItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    data-testid={`my-work-next-${item.key}`}
                    className={cn(
                      cardSurface,
                      focusRing,
                      "flex min-h-tap items-center gap-2.5 px-3 py-2 no-underline",
                      "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
                    )}
                  >
                    <ItemIcon aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</span>
                      <span className={cn(textMuted, "text-xs")}>{item.detail}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-work-pages-heading" className="grid gap-2" data-testid="my-work-pages">
        <h2 id="my-work-pages-heading" className={eyebrowText}>
          Pages
        </h2>
        {/* In the order a reader reaches for them. */}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <li>
            <Link href="/on-call/logistics" data-testid="my-work-page-admin" className={pageCard}>
              <PageCardBody
                icon={ON_CALL_SECTION_ICONS.logistics}
                title={ON_CALL_SECTION_TITLES.logistics}
                description="Leave, rosters, pay, forms and access"
              />
            </Link>
          </li>
          <li>
            <Link href="/on-call/compliance" data-testid="my-work-page-compliance" className={pageCard}>
              <PageCardBody
                icon={ON_CALL_VIEW_ICONS.compliance}
                title={ON_CALL_VIEW_TITLES.compliance}
                description="What has to stay current, with the dates you recorded"
              />
            </Link>
          </li>
          <li>
            <Link href="/on-call/check" data-testid="my-work-page-check" className={pageCard}>
              <PageCardBody
                icon={CalendarCheck}
                title="Check these"
                description="Entries due their twelve-monthly check"
              />
            </Link>
          </li>
          <li>
            <Link href="/on-call/shifts" data-testid="my-work-page-shifts" className={pageCard}>
              <PageCardBody icon={Clock} title="My shifts" description="Your own roster, private to your account" />
            </Link>
          </li>
          <li>
            <Link href="/on-call/calendar" data-testid="my-work-page-calendar" className={pageCard}>
              <PageCardBody
                icon={CalendarDays}
                title="Calendar"
                description="Teaching and recorded expiry dates by month"
              />
            </Link>
          </li>
          <li>
            <Link href="/on-call/orientation" data-testid="my-work-page-orientation" className={pageCard}>
              <PageCardBody
                icon={ON_CALL_SECTION_ICONS.orientation}
                title={ON_CALL_SECTION_TITLES.orientation}
                description="Starting at a new site"
              />
            </Link>
          </li>
          <li>
            {/* The shared settings dialog opens from this one query parameter
                (`SettingsStateProvider`); reminder settings live in it. */}
            <Link href="/?settings=open" data-testid="my-work-page-reminders" className={pageCard}>
              <PageCardBody icon={BellRing} title="Reminder settings" description="Which reminders you get, and when" />
            </Link>
          </li>
        </ul>
      </section>
    </InformationPageShell>
  );
}
