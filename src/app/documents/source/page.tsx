import type { Metadata } from "next";
import { Suspense } from "react";

import { MasterDocumentReader } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Document Reader - Clinical KB",
  description: "Document reader with highlights, bundled demo PDF content, and evidence navigation.",
};

export default function DocumentsSourceRoute() {
  return (
    <Suspense fallback={null}>
      <MasterDocumentReader />
    </Suspense>
  );
}
