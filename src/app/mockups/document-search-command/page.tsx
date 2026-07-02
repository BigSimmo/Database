import type { Metadata } from "next";

import { DocumentSearchMockupPage } from "@/components/document-search-mockups";

export const metadata: Metadata = {
  title: "Document Search Command Mockup - Clinical KB",
  description: "Production-candidate document search command center mockup for Clinical KB.",
};

export default function DocumentSearchCommandMockupRoute() {
  return <DocumentSearchMockupPage variant="command" />;
}
