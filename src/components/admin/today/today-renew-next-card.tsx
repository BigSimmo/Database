import { ExternalLink, Shield } from "lucide-react";
import Link from "next/link";

import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { ModeFeaturedModule } from "@/components/mode-kit/featured-module";
import { TodayWindowBar } from "@/components/admin/today/today-window-bar";
import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { buttonFaceClass } from "@/components/ui/button";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { ADMIN_REQUIREMENTS_CATALOGUE, requirementChecklistRows } from "@/lib/admin/requirements";
import { formatRecordedDate, formatRelativeDate } from "@/lib/admin/renewal-dates";
import type { RenewNextItem } from "@/lib/admin/today-selectors";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/** The catalogue source that explains how to renew this entry, if it matches one. */
function howToRenewUrl(entry: OnCallEntry, ownEntries: readonly OnCallEntry[]): string | undefined {
  const row = requirementChecklistRows(ADMIN_REQUIREMENTS_CATALOGUE, ownEntries).find((r) => r.entry?.id === entry.id);
  return row?.item.sourceUrl;
}

/**
 * "Renew next" (owner-approved order): the one featured module on Today,
 * carrying Admin's brown identity tint via `ModeFeaturedModule` (mode-kit),
 * which sets its own identity marker from the `mode` prop below — this file
 * names the mode but never writes that marker literally, as the
 * design-contract guard requires.
 */
export function TodayRenewNextCard({
  item,
  ownEntries,
  today,
}: {
  item: RenewNextItem;
  ownEntries: readonly OnCallEntry[];
  today: string;
}) {
  const dateLine =
    item.state === "passed"
      ? `Recorded as expiring ${formatRecordedDate(item.date)} — that date has passed`
      : item.kind === "new-job"
        ? `Starts ${formatRecordedDate(item.date)} · ${formatRelativeDate(item.date, today)}`
        : `Expires ${formatRecordedDate(item.date)} · ${formatRelativeDate(item.date, today)}`;

  const renewedHref =
    item.kind === "compliance" && item.entry
      ? `${ADMIN_PAGE_HREFS.renewals}#${onCallEntryAnchorId(item.entry.id)}`
      : ADMIN_PAGE_HREFS.newJob;
  const howToRenewHref =
    item.kind === "compliance" && item.entry
      ? (howToRenewUrl(item.entry, ownEntries) ?? renewedHref)
      : ADMIN_PAGE_HREFS.newJob;
  const howToRenewIsExternal = howToRenewHref.startsWith("http");

  return (
    <ModeFeaturedModule as="section" mode="my-work" className="grid min-w-0 gap-3 p-3" testId="admin-today-renew-next">
      <div className="flex min-w-0 items-center gap-2">
        <Shield aria-hidden="true" strokeWidth={1.5} className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        <h2 className={eyebrowText}>Renew next</h2>
      </div>
      <div className="grid min-w-0 gap-1">
        <p className="text-lg-minus font-semibold text-[color:var(--text-heading)]">{item.title}</p>
        <p className="text-sm text-[color:var(--text-muted)]">{dateLine}</p>
      </div>
      {item.kind === "compliance" && item.windowStart && item.windowEnd ? (
        <TodayWindowBar start={item.windowStart} end={item.windowEnd} today={today} />
      ) : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        {howToRenewIsExternal ? (
          <a
            href={howToRenewHref}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(buttonFaceClass({ variant: "secondary" }), "flex-1")}
            data-testid="admin-today-renew-next-how"
          >
            <ExternalLink aria-hidden="true" className="size-icon-md shrink-0" />
            <span>How to renew</span>
          </a>
        ) : (
          <Link
            href={howToRenewHref}
            className={cn(buttonFaceClass({ variant: "secondary" }), "flex-1")}
            data-testid="admin-today-renew-next-how"
          >
            <ExternalLink aria-hidden="true" className="size-icon-md shrink-0" />
            <span>How to renew</span>
          </Link>
        )}
        <Link
          href={renewedHref}
          className={cn(buttonFaceClass({ variant: "primary" }), "flex-1")}
          data-testid="admin-today-renew-next-renewed"
        >
          Renewed
        </Link>
      </div>
    </ModeFeaturedModule>
  );
}
