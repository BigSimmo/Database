import type { Metadata } from "next";

import { DocumentNavigationPerfectedMockups } from "@/components/document-navigation-perfected-mockups";

export const metadata: Metadata = {
  title: "Document navigation, perfected - PsychSift",
  description:
    "The final document navigation build, including the phone hide and reveal cycle and documents with fewer sections.",
};

export default function DocumentNavigationPerfectedMockupPage() {
  return <DocumentNavigationPerfectedMockups />;
}
