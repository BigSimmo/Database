"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import {
  ON_CALL_SECTION_HREFS,
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
} from "@/components/on-call/on-call-section-identity";
import { cn, textMuted } from "@/components/ui-primitives";
import { ON_CALL_REVIEW_INTERVAL_MONTHS } from "@/lib/on-call/entry-model";
import { type OnCallFreshnessSummary } from "@/lib/on-call/freshness-summary";

/**
 * The one line on the On Call home that admits something has gone out of date.
 *
 * The home's tiles count entries, which is a number that cannot rot: six
 * year-old extensions and six current ones both read "6". This strip is the
 * missing half of that — how many of them nobody has confirmed lately, and
 * which sections they sit in — and its links are the way through, because the
 * fix is always on the entry's own row.
 *
 * Two deliberate restraints:
 *
 * - **It is absent when nothing is stale.** A permanent "0 to check" row is
 *   furniture, and furniture is what teaches a reader to stop seeing a warning.
 * - **Colour carries nothing on its own.** The state is an icon plus the words
 *   "needs checking"; delete every colour class and the strip still says
 *   exactly what it says. The count itself is printed in ordinary ink — a
 *   number is a quantity, not a status, and colouring it would claim a severity
 *   this module has no way to know.
 */

/** Few enough to stay one line on a 320px phone; the rest are summarised. */
export const ON_CALL_STALE_STRIP_SECTION_LIMIT = 3;

/** "1 entry needs checking" / "5 entries need checking" — both halves agree. */
function needsCheckingPhrase(count: number): string {
  return count === 1 ? "1 entry needs checking" : `${count} entries need checking`;
}

const sectionChip = cn(
  "inline-flex min-h-tap items-center gap-1.5 rounded-lg px-3 text-xs font-semibold no-underline",
  "border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
  "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
  focusRing,
);

export function OnCallStaleStrip({ summary, className }: { summary: OnCallFreshnessSummary; className?: string }) {
  if (summary.staleCount === 0) return null;

  const shown = summary.sections.slice(0, ON_CALL_STALE_STRIP_SECTION_LIMIT);
  const remaining = summary.sections.length - shown.length;

  return (
    <section
      aria-labelledby="on-call-home-stale-heading"
      data-testid="on-call-home-stale"
      className={cn(cardSurface, cardPadding.compact, "grid gap-2", className)}
    >
      <div className="flex items-center gap-2">
        <TriangleAlert aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--warning)]" />
        <h2
          id="on-call-home-stale-heading"
          data-testid="on-call-home-stale-count"
          className="text-sm font-semibold text-[color:var(--text-heading)]"
        >
          {needsCheckingPhrase(summary.staleCount)}
        </h2>
      </div>

      {/* Says what "stale" means here, in the same words the entry's own badge
          uses, so the home and the row never sound like two different rules. */}
      <p className={cn(textMuted, "text-xs")}>
        {`Never confirmed, or last confirmed over ${ON_CALL_REVIEW_INTERVAL_MONTHS} months ago.`}
      </p>

      {/* Wraps rather than scrolls: at 320px the chips stack, and the page body
          never gains a sideways scroll it did not have. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((section) => {
          const count = summary.bySection.get(section) ?? 0;
          const title = ON_CALL_SECTION_TITLES[section];
          const SectionIcon = ON_CALL_SECTION_ICONS[section];
          return (
            <Link
              key={section}
              href={ON_CALL_SECTION_HREFS[section]}
              data-testid={`on-call-home-stale-section-${section}`}
              // The chip reads "Contacts 2" by eye, which is only legible next
              // to the heading above it. Spoken, it has to stand alone.
              aria-label={`${title}, ${needsCheckingPhrase(count)}`}
              className={sectionChip}
            >
              <SectionIcon aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
              <span>{title}</span>
              <span className={cn(textMuted, "nums font-bold")}>{count}</span>
            </Link>
          );
        })}
        {remaining > 0 ? (
          <span data-testid="on-call-home-stale-more" className={cn(textMuted, "px-1 text-xs")}>
            {`${remaining} more ${remaining === 1 ? "section" : "sections"}`}
          </span>
        ) : null}
      </div>
    </section>
  );
}
