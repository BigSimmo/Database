import { CalendarDays, ChevronRight, Diamond } from "lucide-react";
import Link from "next/link";

import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { renewalsItemHref } from "@/components/admin/today/today-hrefs";
import { focusRing } from "@/components/card-recipes";
import { ModeRow } from "@/components/mode-kit/grouped-list";
import { modeModuleSurface, modePressable } from "@/components/mode-kit/recipes";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { TextLink } from "@/components/ui/link";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { formatRecordedDate, formatRelativeDate } from "@/lib/admin/renewal-dates";
import type { ComingUp, ComingUpGroup } from "@/lib/admin/today-selectors";

function GroupHeading({ group }: { group: ComingUpGroup }) {
  return (
    <h3
      className="flex min-w-0 items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-medium text-[color:var(--text-muted)]"
      data-testid={`admin-today-coming-up-group-${group.key}`}
    >
      {group.kind === "passed" ? (
        <Diamond aria-hidden="true" strokeWidth={1.5} className="size-icon-xs shrink-0" />
      ) : null}
      {group.label}
    </h3>
  );
}

/**
 * "Coming up" (proposal feature 2): the doctor's recorded dates over the next
 * 12 months, grouped by month, so a month with three things due shows as one
 * block. Anything whose recorded date has passed sits first, under "Date
 * passed" with its own icon — a word and a shape, never colour alone.
 *
 * Each row opens that item's detail on Renewals. The list stops at a handful
 * of rows; "See all in Renewals" follows when there are more. With nothing
 * dated the module says so plainly instead of disappearing, because an absent
 * module would read as "nothing is due".
 */
export function TodayComingUpModule({ comingUp, today }: { comingUp: ComingUp; today: string }) {
  const more = comingUp.total > comingUp.shown;
  return (
    <section className="grid min-w-0 gap-2" data-testid="admin-today-coming-up">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <CalendarDays
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-icon-sm shrink-0 text-[color:var(--text-muted)]"
        />
        <h2 className={eyebrowText}>Coming up</h2>
      </div>
      <div className={modeModuleSurface}>
        {comingUp.groups.length === 0 ? (
          <div className="grid gap-1 px-3 py-3" data-testid="admin-today-coming-up-empty">
            <p className="text-base-minus font-medium text-[color:var(--text-heading)]">
              No recorded dates in the next 12 months
            </p>
            <p className={modeSecondaryText}>
              <TextLink href={ADMIN_PAGE_HREFS.renewals} className="inline-flex min-h-12 items-center">
                Open Renewals
              </TextLink>
            </p>
          </div>
        ) : (
          <>
            {comingUp.groups.map((group, index) => (
              <div
                key={group.key}
                className={cn(index > 0 && "border-t border-[color:var(--border)]")}
                data-group-kind={group.kind}
              >
                <GroupHeading group={group} />
                <ul role="list">
                  {group.rows.map((row) => (
                    <ModeRow
                      key={row.entryId}
                      title={row.title}
                      subtitle={`${formatRecordedDate(row.expiresOn)} · ${formatRelativeDate(row.expiresOn, today)}`}
                      href={renewalsItemHref(row.entryId)}
                      testId="admin-today-coming-up-row"
                    />
                  ))}
                </ul>
              </div>
            ))}
            {more ? (
              <Link
                href={ADMIN_PAGE_HREFS.renewals}
                className={cn(
                  modePressable,
                  focusRing,
                  "flex min-h-12 min-w-0 items-center gap-3 border-t border-[color:var(--border)] px-3 text-sm font-medium text-[color:var(--text-heading)] no-underline",
                )}
                data-testid="admin-today-coming-up-see-all"
              >
                <span className="min-w-0 flex-1">See all in Renewals</span>
                <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
