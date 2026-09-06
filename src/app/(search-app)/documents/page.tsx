import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";
import { consolidatedModeHomeTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";

/**
 * Documents has no home page of its own any more.
 *
 * Documents used to render its own idle view here — browse, recent documents
 * and an "open a source PDF" tile row. The owner reviewed that view directly
 * against the shared home and confirmed none of it held patient- or
 * drug-specific clinical content, only navigational shortcuts he does not
 * need — an informed, approved decision, not the earlier silent regression
 * `consolidated-mode-home-redirect.ts` used to warn readers about. This route
 * stays only so bookmarks and external deep links to `/documents` keep
 * resolving, and forwards to the shared home at `/?mode=documents` instead of
 * rendering a second one. `/documents/search`, `/documents/[id]` and the
 * source-viewer routes are unaffected — they keep rendering exactly as they
 * do today.
 */
type DocumentsHomeRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DocumentsHomeRoute({ searchParams }: DocumentsHomeRouteProps) {
  // Resolved through the same helper the proxy uses, so a request that reaches
  // this backstop lands where the proxy would have sent it — including a
  // submitted `?q=…&run=1`, which goes on to /documents/search rather than
  // arriving at the home with its query dropped.
  const params = searchParams ? await searchParams : {};
  redirect(consolidatedModeHomeTargetForSearchParams("/documents", params) ?? appModeSelectionHref("documents"));
}
