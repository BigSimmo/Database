import type { Metadata } from "next";

import { DictionaryHomePage } from "@/components/dictionary/dictionary-home-page";

export const metadata: Metadata = {
  title: "Clinical Dictionary home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Clinical Dictionary home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function DictionaryDetailedHomeMockupPage() {
  return <DictionaryHomePage />;
}
