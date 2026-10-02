import Link from "next/link";

import { renewalsShowHref } from "@/components/admin/today/today-hrefs";
import { focusRing } from "@/components/card-recipes";
import { modeModuleSurface, modePressable } from "@/components/mode-kit/recipes";
import { modeDisplayNumberText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";
import { RENEWALS_SHOW_FILTERS, RENEWALS_SHOW_LABELS, type RenewalsShowFilter } from "@/lib/admin/renewals-filters";

/**
 * "At a glance" (proposal feature 3): three counts — Date passed, Due in 90
 * days, Not recorded — each opening Renewals already filtered to the rows it
 * counted. The counts come from `renewalsShowCounts`, the same function
 * Renewals filters through, so a number and the list it opens cannot disagree.
 *
 * Numbers are neutral text: the word under each one carries the meaning, and
 * no numeral is painted a status colour. A zero still shows (an absent tile
 * would read as "not checked"), just quieter.
 */
export function TodayAtAGlance({ counts }: { counts: Record<RenewalsShowFilter, number> }) {
  return (
    <section aria-labelledby="admin-today-at-a-glance-heading" data-testid="admin-today-at-a-glance">
      <h2 id="admin-today-at-a-glance-heading" className="sr-only">
        At a glance
      </h2>
      <ul role="list" className="grid grid-cols-3 gap-2">
        {RENEWALS_SHOW_FILTERS.map((filter) => {
          const count = counts[filter];
          const label = RENEWALS_SHOW_LABELS[filter];
          return (
            <li key={filter} className="min-w-0">
              <Link
                href={renewalsShowHref(filter)}
                aria-label={`${label}: ${count}`}
                className={cn(
                  modeModuleSurface,
                  modePressable,
                  focusRing,
                  "flex h-full min-h-12 min-w-0 flex-col justify-between gap-1 px-3 py-2 no-underline",
                )}
                data-testid={`admin-today-at-a-glance-${filter}`}
                data-zero={count === 0 ? "" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    modeDisplayNumberText,
                    "text-2xl leading-8",
                    count === 0 ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-heading)]",
                  )}
                >
                  {count}
                </span>
                <span aria-hidden="true" className="break-words text-xs leading-4 text-[color:var(--text-muted)]">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
