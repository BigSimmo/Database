import type { Metadata } from "next";

import { MasterDocumentSearch } from "@/components/master-document-flow-mockups";

export const metadata: Metadata = {
  title: "Document Search - Clinical KB",
  description: "Search indexed clinical documents and review matching evidence.",
};

export default function DocumentsSearchRoute() {
  return <MasterDocumentSearch />;
}
