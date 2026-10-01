import { CalendarPlus, CircleAlert, ChevronRight } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { modeInsetHairline, modeModuleSurface, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { RENEWALS_RECORD_MISSING_HREF, renewalsItemHref, renewalsShowHref } from "@/components/admin/today/today-hrefs";
import { TodayUrgencyMark } from "@/components/admin/today/today-urgency-mark";
import { buttonFaceClass } from "@/components/ui/button";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formatRecordedDate, formatRelativeDate } from "@/lib/admin/renewal-dates";
import type { NeedsYou, NeedsYouRow } from "@/lib/admin/today-selectors";

/**
 * A passed row opens that item's detail on Renewals; the grouped
 * not-recorded row opens Renewals' checklist filtered to what has no date.
 */
function rowHref(row: NeedsYouRow): string {
  return row.kind === "passed" ? renewalsItemHref(row.entry.id) : renewalsShowHref("not-recorded");
}

const NAMED_TITLES = 3;

function notRecordedHeading(titles: readonly string[]): string {
  return `${titles.length} ${titles.length === 1 ? "date" : "dates"} not recorded`;
}

/** The first few names, then "and N more", so a long gap list stays one line or two. */
function notRecordedNames(titles: readonly string[]): string {
  const named = titles.slice(0, NAMED_TITLES).join(", ");
  const more = titles.length - NAMED_TITLES;
  return more > 0 ? `${named} and ${more} more` : named;
}

const chevron = <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />;

function PlainRow({ row, today }: { row: NeedsYouRow; today: string }) {
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
            {row.kind === "passed" ? row.entry.title : notRecordedHeading(row.titles)}
          </span>
          <span className={cn(modeSecondaryText, "break-words")}>
            {row.kind === "passed"
              ? `${formatRecordedDate(row.expiresOn)} · ${formatRelativeDate(row.expiresOn, today)}`
              : notRecordedNames(row.titles)}
          </span>
          {row.kind === "passed" && row.needsChecking ? (
            <span className={cn(modeSecondaryText, "break-words")}>Check with your service</span>
          ) : null}
        </span>
        {row.kind === "passed" ? <TodayUrgencyMark state="passed" /> : null}
        {chevron}
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
 *
 * Every row is a whole-row link ending in a chevron. While any date is still
 * unrecorded the card closes on "Record dates", which opens Renewals' "Record
 * missing dates" sheet — the module names a job, so it also starts it.
 */
export function TodayNeedsYouModule({ needsYou, today }: { needsYou: NeedsYou; today: string }) {
  const { featured, rows, notRecordedCount } = needsYou;
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
          className={cn(modePressable, focusRing, "flex min-w-0 items-center gap-2 px-3 py-3 pr-3 no-underline")}
          data-testid="admin-today-needs-you-featured"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 items-start justify-between gap-3">
              <span className="text-base-minus font-medium text-[color:var(--text-heading)]">
                {featured.kind === "passed" ? featured.entry.title : notRecordedHeading(featured.titles)}
              </span>
              {featured.kind === "passed" ? <TodayUrgencyMark state="passed" /> : null}
            </span>
            {featured.kind === "passed" ? (
              <>
                <span className={cn(modeSecondaryText, "break-words")}>
                  {formatRecordedDate(featured.expiresOn)} · {formatRelativeDate(featured.expiresOn, today)}
                </span>
                {featured.needsChecking ? (
                  <span className={cn(modeSecondaryText, "break-words")}>Check with your service</span>
                ) : null}
              </>
            ) : (
              <span className={cn(modeSecondaryText, "break-words")}>{notRecordedNames(featured.titles)}</span>
            )}
          </span>
          {chevron}
        </Link>
        {rows.length > 0 ? (
          // `modeInsetHairline` hides its own hairline on the first `<li>` of
          // its list (it assumes that `<li>` is the module's first row); here
          // it follows the featured block instead, so this border-top draws
          // the divider that separator would otherwise have drawn.
          <ul role="list" className="border-t border-[color:var(--border)]" data-testid="admin-today-needs-you-rows">
            {rows.map((row) => (
              <PlainRow key={row.key} row={row} today={today} />
            ))}
          </ul>
        ) : null}
        {notRecordedCount > 0 ? (
          <div className="border-t border-[color:var(--border)] p-3">
            <Link
              href={RENEWALS_RECORD_MISSING_HREF}
              className={buttonFaceClass({ variant: "secondary", block: true })}
              data-testid="admin-today-needs-you-record"
            >
              <CalendarPlus aria-hidden="true" className="size-icon-md shrink-0" />
              <span>Record dates</span>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
