import type { Metadata } from "next";

import { DictionaryHomePage } from "@/components/dictionary/dictionary-home-page";

export const metadata: Metadata = {
  title: "Clinical Dictionary | Clinical KB",
  description: "Search source-governed psychiatric terminology, abbreviations, topics, and distinctions.",
};

export default function DictionaryRoute() {
  return <DictionaryHomePage />;
}
