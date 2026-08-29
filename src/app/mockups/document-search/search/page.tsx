import type { Metadata } from "next";
import { Suspense } from "react";
import { MasterDocumentSearch } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = { title: "Document Search Mockup - PsychSift" };
export default function DocumentSearchMockupRoute() {
  return (
    <Suspense fallback={null}>
      <MasterDocumentSearch />
    </Suspense>
  );
}
