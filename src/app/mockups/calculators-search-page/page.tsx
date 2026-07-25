import type { Metadata } from "next";

import { CalculatorsSearchPage } from "@/components/calculators";

export const metadata: Metadata = {
  title: "Calculators Search Page Mockup - Clinical KB",
  description:
    "Search-results-shell psychiatry calculators page listing every calculator as a tile with a domain rail and popup scoring for Clinical KB.",
};

export default function CalculatorsSearchPageMockupRoute() {
  return <CalculatorsSearchPage />;
}
