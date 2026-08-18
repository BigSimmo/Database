import type { Metadata } from "next";
import { Suspense } from "react";

import { DictionarySearchPage } from "@/components/dictionary/dictionary-catalogue-pages";
import { LoadingPanel } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Search clinical terms | Clinical KB",
  description: "Search definitions, governed abbreviations, and clinical topic collections.",
};

export default function DictionarySearchRoute() {
  return (
    <Suspense fallback={<LoadingPanel variant="skeleton" lines={6} label="Loading dictionary results" />}>
      <DictionarySearchPage />
    </Suspense>
  );
}
