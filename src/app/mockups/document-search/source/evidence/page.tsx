import type { Metadata } from "next";
import { Suspense } from "react";

import { MasterEvidenceDetail } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Evidence Detail Mockup - Clinical KB",
  description: "Functional evidence object mockup for tables, quotes, images, and source page context.",
};

export default function DocumentSearchEvidenceDetailRoute() {
  return (
    <Suspense fallback={null}>
      <MasterEvidenceDetail />
    </Suspense>
  );
}
