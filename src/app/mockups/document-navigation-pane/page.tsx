import type { Metadata } from "next";

import { DocumentNavigationPaneMockups } from "@/components/document-navigation-pane-mockups";

export const metadata: Metadata = {
  title: "Document navigation pane mockups - Clinical KB",
  description:
    "Three navigation panes anchored to the universal header for the document page, shown on desktop, tablet, and phone.",
};

export default function DocumentNavigationPaneMockupPage() {
  return <DocumentNavigationPaneMockups />;
}
