import type { Metadata } from "next";
import { Suspense } from "react";

import { MasterDocumentIndex } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Document Search Mockups - Clinical KB",
  description: "Master runnable document-search UX flow for Clinical KB document mode.",
};

export default function DocumentSearchMockupsIndexRoute() {
  return (
    <Suspense fallback={null}>
      <MasterDocumentIndex />
    </Suspense>
  );
}
