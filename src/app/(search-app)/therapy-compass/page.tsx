import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";

/**
 * `Therapy` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This path stays so
 * bookmarks and external deep links keep resolving, and forwards to that shared
 * home. Submitted searches render at `/therapy-compass/search`; the proxy carries the
 * query across, so a deep link never lands here without one.
 *
 * The previous detailed page is preserved, off the live routes, at
 * `/mockups/therapy-compass-home-detailed`.
 */
export default function TherapyCompassHomeRoute() {
  redirect(appModeSelectionHref("therapy-compass"));
}
