import type { Metadata } from "next";
import { Suspense } from "react";

import { DictionaryBrowsePage } from "@/components/dictionary/dictionary-catalogue-pages";
import { LoadingPanel } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Browse clinical terms | Clinical KB",
  description: "Browse 96 source-governed clinical terms and abbreviations.",
};

export default function DictionaryBrowseRoute() {
  return (
    <Suspense fallback={<LoadingPanel variant="skeleton" lines={6} label="Loading dictionary catalogue" />}>
      <DictionaryBrowsePage />
    </Suspense>
  );
}
