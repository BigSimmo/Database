import type { Metadata } from "next";

import { DocumentsHomeClient } from "./documents-home-client";

export const metadata: Metadata = {
  title: "Documents - Clinical KB",
  description: "Browse indexed clinical sources, recent documents, and source PDFs.",
};

/**
 * The Documents mode home.
 *
 * `/` is the single shared home for every other mode — the mode pill retargets
 * the composer rather than navigating — but Documents is a real workspace, not a
 * duplicate landing page: it has its own browse/recent-documents/open-a-source-PDF
 * affordances that don't exist anywhere else, the same way `/medications` has its
 * own prescribing workspace. Folding it into the generic shared home silently
 * deleted those affordances; this route keeps them. The body comes from
 * ClinicalDashboard, which the shared shell mounts for this pathname (see
 * `shouldRenderClinicalDashboard`); this route is the content slot, mirroring the
 * root `home-page-client.tsx`.
 */
export default function DocumentsHomeRoute() {
  return <DocumentsHomeClient />;
}
