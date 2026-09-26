"use client";

import { OnCallHandbookState } from "@/components/on-call/kit/handbook-state";
import { OnCallHospitalLine } from "@/components/on-call/kit/hospital-line";
import { OnCallHubPageFrame } from "@/components/on-call/kit/hub-page-frame";
import { ON_CALL_HUB_PAGE_ICONS } from "@/components/on-call/on-call-section-identity";
import { useHospitalHandbook } from "@/components/on-call/use-hospital-handbook";
import { EmptyState } from "@/components/primitive-recipes/feedback";

/**
 * Find: wards, equipment, manuals and the downtime plan.
 *
 * A kit stub (task 1.9): the frame, the handbook states and a "Being set up"
 * notice, so the route, its title and its place in the pill exist before the
 * page's own lane builds the modules.
 */
export function OnCallFindPage() {
  const handbook = useHospitalHandbook();
  return (
    <OnCallHubPageFrame page="find" sections={[]} lead={<OnCallHospitalLine handbook={handbook} />}>
      <OnCallHandbookState handbook={handbook} page="find" />
      {handbook.status === "ready" ? (
        <EmptyState
          icon={ON_CALL_HUB_PAGE_ICONS["find"]}
          title="Being set up"
          body="This page is being built. Until then, the pill above opens the pages that already work."
          testId="on-call-find-being-set-up"
        />
      ) : null}
    </OnCallHubPageFrame>
  );
}
