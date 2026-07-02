import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentSearchLiveOpener } from "@/components/document-search-live-opener";

export const metadata: Metadata = {
  title: "Open Highlighted Document - Clinical KB",
  description: "Resolves a document-search mockup result to the live document viewer with a selected source chunk.",
};

export default function HighlightedDocumentSearchSourceRoute() {
  return (
    <Suspense fallback={null}>
      <DocumentSearchLiveOpener />
    </Suspense>
  );
}
