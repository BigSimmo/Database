import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";
import { consolidatedModeHomeTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";

/**
 * `Sources` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This route stays so
 * bookmarks and external deep links to `/sources` keep working, and forwards to
 * that shared home rather than rendering a second one. The four-card home that
 * used to live here duplicated the shared home's title and subtitle, and its cards
 * duplicated the Sources tab bar (`modeSecondaryNavigationRegistry`); the shared
 * home carries a `Show all` chip to the catalogue in their place.
 */
type SourcesHomeRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesHomeRoute({ searchParams }: SourcesHomeRouteProps) {
  // Resolved through the same helper the proxy uses, so a request that reaches
  // this backstop lands where the proxy would have sent it — including a submitted
  // `?q=…&run=1` or a filter-only link such as `?topic=governance`, both of which
  // go on to /sources/search rather than arriving at the home with the selection
  // silently dropped.
  const params = searchParams ? await searchParams : {};
  redirect(consolidatedModeHomeTargetForSearchParams("/sources", params) ?? appModeSelectionHref("sources"));
}
