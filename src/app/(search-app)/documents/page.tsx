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
 * consolidated modes. Its home was the same `ModeHomeTemplate` the shared home
 * uses, with the same subtitle — the only extras were three action shortcuts
 * (browse / continue reading / open a source PDF) and an indexed-source count,
 * which the owner accepted losing rather than carry a second home for.
 */
export default function DocumentsHomeRoute() {
  redirect(appModeSelectionHref("documents"));
}
