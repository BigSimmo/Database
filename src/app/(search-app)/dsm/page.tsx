import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";

/**
 * `DSM-5 Diagnosis` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This route stays so
 * bookmarks and external deep links to `/dsm` keep working, and forwards to
 * that shared home rather than rendering a second one.
 *
 * The previous detailed page is preserved, off the live routes, at
 * `/mockups/dsm-home-detailed`.
 */
export default function DsmHomeRoute() {
  redirect(appModeSelectionHref("dsm"));
}
