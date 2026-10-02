import { ChevronRight, IdCard } from "lucide-react";
import Link from "next/link";

import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { focusRing } from "@/components/card-recipes";
import { modeModuleSurface, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";
import type { RequirementsSummary } from "@/lib/admin/today-selectors";

/**
 * "Requirements" (owner-approved order): "7 of 10 recorded · 1 not for this
 * job" in words, plus "Dates you entered, not a check" — no score bars, no
 * verdict.
 *
 * The whole card is the link to Renewals, ending in a chevron, rather than a
 * small "Open" in the header: the card is the target, so the target is the
 * card. The eyebrow stays outside the link so the page's heading outline is
 * unchanged and the link's name is just what the card says.
 */
export function TodayRequirementsModule({ summary }: { summary: RequirementsSummary }) {
  const count = `${summary.recorded} of ${summary.total} recorded${
    summary.notForThisJob > 0 ? ` · ${summary.notForThisJob} not for this job` : ""
  }`;
  return (
    <section className="grid min-w-0 gap-2" data-testid="admin-today-requirements">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <IdCard aria-hidden="true" strokeWidth={1.5} className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        <h2 className={cn(eyebrowText, "min-w-0 flex-1")}>Requirements</h2>
      </div>
      <Link
        href={ADMIN_PAGE_HREFS.renewals}
        className={cn(
          modeModuleSurface,
          modeRowHeight.double,
          modePressable,
          focusRing,
          "flex min-w-0 items-center gap-3 px-3 py-1 no-underline",
        )}
        data-testid="admin-today-requirements-link"
      >
        <span className="grid min-w-0 flex-1 gap-0.5 py-1">
          <span className={cn(modeNameText, "break-words text-base-minus leading-5 text-[color:var(--text-heading)]")}>
            {count}
          </span>
          <span className={cn(modeSecondaryText, "break-words leading-5")}>Dates you entered, not a check</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      </Link>
    </section>
  );
}
