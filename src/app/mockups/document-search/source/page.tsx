import type { Metadata } from "next";
import { Suspense } from "react";
import { MasterDocumentReader } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = { title: "Document Reader Mockup - PsychSift" };
export default function DocumentReaderMockupRoute() {
  return (
    <Suspense fallback={null}>
      <MasterDocumentReader />
    </Suspense>
  );
}
