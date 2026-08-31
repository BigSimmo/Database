import type { Metadata } from "next";

import { DictionarySourcesPage } from "@/components/dictionary/dictionary-sources-page";

export const metadata: Metadata = {
  title: "Dictionary sources and review | PsychSift",
  description: "Understand source checking, authority coverage, and dictionary review cadence.",
};

export default function DictionarySourcesRoute() {
  return <DictionarySourcesPage />;
}
