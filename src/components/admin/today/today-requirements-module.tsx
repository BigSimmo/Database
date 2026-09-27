import { IdCard } from "lucide-react";

import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { TodaySummaryModule } from "@/components/admin/today/today-summary-module";
import { ModeRow } from "@/components/mode-kit/grouped-list";
import type { RequirementsSummary } from "@/lib/admin/today-selectors";

/**
 * "Requirements" (owner-approved order): "7 of 10 recorded · 1 not for this
 * job" in words, plus "Dates you entered, not a check" — no score bars, no
 * verdict.
 */
export function TodayRequirementsModule({ summary }: { summary: RequirementsSummary }) {
  const count = `${summary.recorded} of ${summary.total} recorded${
    summary.notForThisJob > 0 ? ` · ${summary.notForThisJob} not for this job` : ""
  }`;
  return (
    <TodaySummaryModule
      eyebrow="Requirements"
      icon={IdCard}
      openHref={ADMIN_PAGE_HREFS.renewals}
      testId="admin-today-requirements"
    >
      <ModeRow title={count} subtitle="Dates you entered, not a check" />
    </TodaySummaryModule>
  );
}
