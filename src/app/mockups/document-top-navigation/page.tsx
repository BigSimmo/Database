import type { Metadata } from "next";

import { DocumentTopNavigationMockups } from "@/components/document-top-navigation-mockups";

export const metadata: Metadata = {
  title: "Document navigation menu mockups - PsychSift",
  description: "Three responsive document-page navigation concepts for phone, tablet, and desktop.",
};

export default function DocumentTopNavigationMockupPage() {
  return <DocumentTopNavigationMockups />;
}
