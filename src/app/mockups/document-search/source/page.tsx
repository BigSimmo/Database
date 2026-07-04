import type { Metadata } from "next";
import { Suspense } from "react";

import { MasterDocumentReader } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Document Reader Mockup - Clinical KB",
  description: "Functional document reader mockup with bundled PDF content, highlights, and evidence inspector.",
};

export default function HighlightedDocumentSearchSourceRoute() {
  return (
    <Suspense fallback={null}>
      <MasterDocumentReader />
    </Suspense>
  );
}
