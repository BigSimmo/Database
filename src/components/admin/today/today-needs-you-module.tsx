import { CircleAlert, ChevronRight } from "lucide-react";
import Link from "next/link";

import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { focusRing } from "@/components/card-recipes";
import { modeInsetHairline, modeModuleSurface, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { TodayUrgencyMark } from "@/components/admin/today/today-urgency-mark";
import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formatRecordedDate, formatRelativeDate } from "@/lib/admin/renewal-dates";
import type { NeedsYou, NeedsYouRow } from "@/lib/admin/today-selectors";

function rowHref(row: NeedsYouRow): string {
  return row.kind === "passed"
    ? `${ADMIN_PAGE_HREFS.renewals}#${onCallEntryAnchorId(row.entry.id)}`
    : ADMIN_PAGE_HREFS.renewals;
}

function PlainRow({ row }: { row: NeedsYouRow }) {
  return (
    <li className={cn(modeInsetHairline, modeRowHeight.double, "flex min-w-0 items-center pl-3 pr-1")}>
      <Link
        href={rowHref(row)}
        className={cn(
          modePressable,
          focusRing,
          "flex min-h-13 min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 no-underline",
        )}
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={cn(modeNameText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
            {row.kind === "passed" ? row.entry.title : `${row.titles.length} dates not recorded`}
          </span>
          <span className={cn(modeSecondaryText, "break-words")}>
            {row.kind === "passed" ? "Check with your service" : row.titles.join(", ")}
          </span>
        </span>
        {row.kind === "passed" ? <TodayUrgencyMark state="passed" /> : null}
        <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
      </Link>
    </li>
  );
}

/**
 * "Needs you" (owner-approved order): one featured row, then at most two plain
 * rows. The featured row is the fuller of the two treatments — title, the
 * recorded date in words, and the "check with your service" line — because it
 * is the one thing this module most wants read; the plain rows below share one
 * list, each 48–52px, the shape every other Admin list uses.
 */
export function TodayNeedsYouModule({ needsYou, today }: { needsYou: NeedsYou; today: string }) {
  const { featured, rows } = needsYou;
  return (
    <section className="grid min-w-0 gap-2" data-testid="admin-today-needs-you">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <CircleAlert
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-icon-sm shrink-0 text-[color:var(--text-muted)]"
        />
        <h2 className={eyebrowText}>Needs you</h2>
      </div>
      <div className={modeModuleSurface}>
        <Link
          href={rowHref(featured)}
          className={cn(modePressable, focusRing, "flex min-w-0 flex-col gap-1 px-3 py-3 no-underline")}
          data-testid="admin-today-needs-you-featured"
        >
          <span className="flex min-w-0 items-start justify-between gap-3">
            <span className="text-base-minus font-medium text-[color:var(--text-heading)]">
              {featured.kind === "passed" ? featured.entry.title : `${featured.titles.length} dates not recorded`}
            </span>
            {featured.kind === "passed" ? <TodayUrgencyMark state="passed" /> : null}
          </span>
          {featured.kind === "passed" ? (
            <>
              <span className={cn(modeSecondaryText, "break-words")}>
                {formatRecordedDate(featured.expiresOn)} · {formatRelativeDate(featured.expiresOn, today)}
              </span>
              <span className={cn(modeSecondaryText, "break-words")}>Check with your service</span>
            </>
          ) : (
            <span className={cn(modeSecondaryText, "break-words")}>{featured.titles.join(", ")}</span>
          )}
        </Link>
        {rows.length > 0 ? (
          // `modeInsetHairline` hides its own hairline on the first `<li>` of
          // its list (it assumes that `<li>` is the module's first row); here
          // it follows the featured block instead, so this border-top draws
          // the divider that separator would otherwise have drawn.
          <ul role="list" className="border-t border-[color:var(--border)]" data-testid="admin-today-needs-you-rows">
            {rows.map((row) => (
              <PlainRow key={row.key} row={row} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
