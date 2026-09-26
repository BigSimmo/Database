"use client";

import { OnCallHandbookState } from "@/components/on-call/kit/handbook-state";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { OnCallHospitalLine } from "@/components/on-call/kit/hospital-line";
import { OnCallHubPageFrame } from "@/components/on-call/kit/hub-page-frame";
import { onCallInsetHairline, onCallPressable, onCallRowHeight } from "@/components/on-call/kit/recipes";
import { onCallNameText } from "@/components/on-call/kit/type";
import { ON_CALL_HUB_PAGE_ICONS } from "@/components/on-call/on-call-section-identity";
import { useHospitalHandbook } from "@/components/on-call/use-hospital-handbook";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn } from "@/components/ui-primitives";

/**
 * Refer: how to reach each service at the hospital, and the reader's own referral notes.
 *
 * A kit stub (task 1.9): the frame, the handbook states and a "Being set up"
 * notice, so the route, its title and its place in the pill exist before the
 * page's own lane builds the modules.
 */
export function OnCallReferPage() {
  const handbook = useHospitalHandbook();
  return (
    <OnCallHubPageFrame page="refer" sections={[]} lead={<OnCallHospitalLine handbook={handbook} />}>
      <OnCallHandbookState handbook={handbook} page="refer" />
      {handbook.status === "ready" ? (
        <EmptyState
          icon={ON_CALL_HUB_PAGE_ICONS["refer"]}
          title="Being set up"
          body="This page is being built. Until then, the pill above opens the pages that already work."
          testId="on-call-refer-being-set-up"
        />
      ) : null}
      {/* The reader's own list stays reachable from here; the lane build keeps
          it in its "Mine" group. */}
      <OnCallGroupedList eyebrow="Mine" id="on-call-group-mine" testId="on-call-refer-mine">
        <li className={cn(onCallInsetHairline, "min-w-0")}>
          {/* A literal next/link href: route-reachability counts only those. */}
          <Link
            href="/on-call/referrals"
            data-testid="on-call-refer-mine-link"
            className={cn(
              onCallRowHeight.single,
              onCallPressable,
              focusRing,
              "flex min-w-0 items-center gap-3 px-3 text-[color:var(--text-heading)] no-underline",
            )}
          >
            <span className={cn(onCallNameText, "min-w-0 flex-1 break-words text-base-minus")}>Your own referrals</span>
            <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          </Link>
        </li>
      </OnCallGroupedList>
    </OnCallHubPageFrame>
  );
}
