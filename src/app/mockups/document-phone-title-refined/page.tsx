import type { Metadata } from "next";

import { DocumentPhoneTitleRefinedMockups } from "@/components/document-phone-title-refined-mockups";

export const metadata: Metadata = {
  title: "Document phone title refined mockups - PsychSift",
  description: "Three corrected variants of the fused phone title row for the document page.",
};

export default function DocumentPhoneTitleRefinedMockupPage() {
  return <DocumentPhoneTitleRefinedMockups />;
}
