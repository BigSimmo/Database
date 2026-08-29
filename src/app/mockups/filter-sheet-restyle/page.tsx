import type { Metadata } from "next";

import { FilterSheetRestyleMockupsPage } from "@/components/filter-sheet-restyle-mockups";

export const metadata: Metadata = {
  title: "Filter sheet restyle · three styles - PsychSift",
  description:
    "Three style directions for the shared filter sheet, drawn on the formulation specimen, with the segmented bar repurposed as a result-scope control.",
};

export default function FilterSheetRestyleMockupPage() {
  return <FilterSheetRestyleMockupsPage />;
}
