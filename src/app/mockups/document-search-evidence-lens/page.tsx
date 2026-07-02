import type { Metadata } from "next";

import { DocumentSearchMockupPage } from "@/components/document-search-mockups";

export const metadata: Metadata = {
  title: "Document Search Evidence Lens Mockup - Clinical KB",
  description: "Document search evidence lens mockup with selected source proof in view.",
};

export default function DocumentSearchEvidenceLensMockupRoute() {
  return <DocumentSearchMockupPage variant="evidence-lens" />;
}
