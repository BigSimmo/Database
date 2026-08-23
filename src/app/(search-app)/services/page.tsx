import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";
import { consolidatedModeHomeTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";

/**
 * `Clinical Services` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This path stays so
 * bookmarks and external deep links keep resolving, and forwards to that shared
 * home. Submitted searches render at `/services/search`; the proxy carries the
 * query across, so a deep link never lands here without one.
 */
type ServicesHomeRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ServicesHomeRoute({ searchParams }: ServicesHomeRouteProps) {
  // Resolved through the same helper the proxy uses, so a request that reaches
  // this backstop lands where the proxy would have sent it — including a
  // submitted `?q=…&run=1`, which goes on to /services/search rather than
  // arriving at the home with its query dropped.
  const params = searchParams ? await searchParams : {};
  redirect(consolidatedModeHomeTargetForSearchParams("/services", params) ?? appModeSelectionHref("services"));
}
