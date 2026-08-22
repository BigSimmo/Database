import type { Metadata } from "next";
import { Suspense } from "react";

import { DictionaryCataloguePage } from "@/components/dictionary/dictionary-catalogue-pages";
import { LoadingPanel } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Clinical terms | Clinical KB",
  description: "Search or browse 96 source-governed clinical terms and their governed abbreviations.",
};

export default function DictionaryCatalogueRoute() {
  return (
    <Suspense fallback={<LoadingPanel variant="skeleton" lines={6} label="Loading the dictionary catalogue" />}>
      <DictionaryCataloguePage />
    </Suspense>
  );
}
