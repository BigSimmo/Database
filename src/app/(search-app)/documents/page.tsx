import type { Metadata } from "next";

import { DocumentsHomeClient } from "./documents-home-client";

export const metadata: Metadata = {
  title: "Documents - Clinical KB",
  description: "Browse indexed clinical sources, recent documents, and source PDFs.",
};

/**
 * The Documents mode home.
 *
 * `/` is the single shared home for every mode — the mode pill retargets the
 * composer rather than navigating — so Documents needs a home of its own, the same
 * way /dsm, /services and /tools do. The body comes from ClinicalDashboard, which
 * the shared shell mounts for this pathname (see `shouldRenderClinicalDashboard`);
 * this route is the content slot, mirroring the root `home-page-client.tsx`.
 */
export default function DocumentsHomeRoute() {
  return <DocumentsHomeClient />;
}
