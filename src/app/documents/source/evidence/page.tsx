import type { Metadata } from "next";
import { Suspense } from "react";

import { MasterEvidenceDetail } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Evidence Detail - Clinical KB",
  description: "Evidence detail for tables, quotes, images, and source page context.",
};

export default function DocumentsEvidenceRoute() {
  return (
    <Suspense fallback={null}>
      <MasterEvidenceDetail />
    </Suspense>
  );
}
