import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";

/**
 * `Therapy` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This path stays so
 * bookmarks and external deep links keep resolving, and forwards to that shared
 * home. Submitted searches render at `/therapy-compass/search`; the proxy carries
 * the query across, so a deep link never lands here without one.
 *
 * The rest of the Therapy workspace is untouched — search, compare, recommend,
 * pathways and every record route still render themselves. Only the home screen
 * retired, and it is preserved off the live routes at
 * `/mockups/therapy-compass-home-detailed`.
 *
 * Consolidating this mode was blocked while it was `devOnly`: the shared home
 * hides devOnly modes in production, so `/?mode=therapy-compass` came back as
 * mode Answer. PR #2150 shipped Therapy in production with its review state
 * disclosed, which lifted that gate.
 */
export default function TherapyCompassHomeRoute() {
  redirect(appModeSelectionHref("therapy-compass"));
}
