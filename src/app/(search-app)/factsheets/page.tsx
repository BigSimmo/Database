import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";

/**
 * `Patient Factsheets` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This route stays so
 * bookmarks and external deep links to `/factsheets` keep working, and forwards to
 * that shared home rather than rendering a second one.
 *
 * The previous detailed page is preserved, off the live routes, at
 * `/mockups/factsheets-home-detailed`.
 */
export default function FactsheetsHomeRoute() {
  redirect(appModeSelectionHref("factsheets"));
}
