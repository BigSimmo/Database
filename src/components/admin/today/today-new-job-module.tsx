import { BriefcaseBusiness } from "lucide-react";

import { ADMIN_NEW_JOB_SECTIONS, ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { TodaySummaryModule } from "@/components/admin/today/today-summary-module";
import { ModeRow } from "@/components/mode-kit/grouped-list";
import { formatRecordedDate, formatRelativeDate } from "@/lib/admin/renewal-dates";
import type { NewJobProgress } from "@/lib/admin/new-job-progress";

/**
 * "New job progress" (owner-approved order): shown only while
 * `selectNewJobProgress` returns non-null — the caller decides that, this
 * component only draws it.
 */
export function TodayNewJobModule({ progress, today }: { progress: NewJobProgress; today: string }) {
  return (
    <TodaySummaryModule
      eyebrow="New job"
      icon={BriefcaseBusiness}
      openHref={ADMIN_PAGE_HREFS.newJob}
      testId="admin-today-new-job"
    >
      <ModeRow
        title={`Starts ${formatRecordedDate(progress.startsOn)}`}
        subtitle={`${formatRelativeDate(progress.startsOn, today)} · ${progress.done} of ${progress.total} done`}
      />
      {progress.nextStep ? (
        <ModeRow
          title={progress.nextStep}
          subtitle="Next step"
          href={`${ADMIN_PAGE_HREFS.newJob}#${ADMIN_NEW_JOB_SECTIONS[0].id}`}
          testId="admin-today-new-job-next-step"
        />
      ) : (
        <ModeRow title="All steps done" />
      )}
    </TodaySummaryModule>
  );
}
