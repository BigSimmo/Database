import type { Metadata } from "next";

import { DocumentSearchMockupPage } from "@/components/document-search-mockups";

export const metadata: Metadata = {
  title: "Document Search Triage Board Mockup - Clinical KB",
  description: "Discovery-first document library triage board mockup for Clinical KB.",
};

export default function DocumentSearchTriageBoardMockupRoute() {
  return <DocumentSearchMockupPage variant="triage-board" />;
}
