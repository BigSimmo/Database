import type { Metadata } from "next";

import { DocumentPhoneTitleMockups } from "@/components/document-phone-title-mockups";

export const metadata: Metadata = {
  title: "Document phone title mockups - PsychSift",
  description: "Three ways to keep the document title visible on a phone alongside the navigation pane.",
};

export default function DocumentPhoneTitleMockupPage() {
  return <DocumentPhoneTitleMockups />;
}
