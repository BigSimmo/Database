import type { Metadata } from "next";
import { Suspense } from "react";

import { DictionaryTopicsPage } from "@/components/dictionary/dictionary-catalogue-pages";
import { LoadingPanel } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Clinical dictionary topics | Clinical KB",
  description: "Browse twelve governed clinical terminology collections.",
};

export default function DictionaryTopicsRoute() {
  return (
    <Suspense fallback={<LoadingPanel variant="skeleton" lines={6} label="Loading dictionary topics" />}>
      <DictionaryTopicsPage />
    </Suspense>
  );
}
