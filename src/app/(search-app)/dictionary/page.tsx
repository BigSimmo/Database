import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";
import { consolidatedModeHomeTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";

/**
 * `Clinical Dictionary` has no home page of its own any more.
 *
 * Every mode shares one lightweight home at `/?mode=<id>`, whose per-mode copy
 * lives in `sharedHomePresentation` (src/lib/ui-copy.ts). This route stays so
 * bookmarks and external deep links to `/dictionary` keep working, and forwards to
 * that shared home rather than rendering a second one.
 */
type DictionaryHomeRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DictionaryHomeRoute({ searchParams }: DictionaryHomeRouteProps) {
  // Resolved through the same helper the proxy uses, so a request that reaches
  // this backstop lands where the proxy would have sent it — including a
  // submitted `?q=…&run=1`, which goes on to /dictionary/search rather than
  // arriving at the home with its query dropped.
  const params = searchParams ? await searchParams : {};
  redirect(consolidatedModeHomeTargetForSearchParams("/dictionary", params) ?? appModeSelectionHref("dictionary"));
}
