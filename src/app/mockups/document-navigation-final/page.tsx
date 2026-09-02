import type { Metadata } from "next";

import { DocumentNavigationFinalMockups } from "@/components/document-navigation-final-mockups";

export const metadata: Metadata = {
  title: "Document navigation, final design - PsychSift",
  description:
    "The final document navigation design: segment-track header row and a two-column section grid, at desktop, tablet, and phone.",
};

export default function DocumentNavigationFinalMockupPage() {
  return <DocumentNavigationFinalMockups />;
}
