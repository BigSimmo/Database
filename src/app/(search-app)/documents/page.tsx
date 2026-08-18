import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";

/**
 * `Documents` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This path stays so
 * bookmarks and external deep links keep resolving, and forwards to that shared
 * home. Submitted searches render at `/documents/search`; the proxy carries the
 * query across, so a deep link never lands here without one.
 *
 * Nothing is preserved under `/mockups` for this one, unlike the other
 * consolidated modes: this route's component was an empty fragment and the body
 * came from ClinicalDashboard, so there was no detailed page to keep.
 */
export default function DocumentsHomeRoute() {
  redirect(appModeSelectionHref("documents"));
}
