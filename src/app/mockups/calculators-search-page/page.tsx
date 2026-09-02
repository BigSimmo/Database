import type { Metadata } from "next";

import { CalculatorsSearchPageMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Search Page Mockup - PsychSift",
  description:
    "Search-results-shell psychiatry calculators page listing every calculator as a tile with a domain rail and popup scoring for PsychSift.",
};

export default function CalculatorsSearchPageMockupRoute() {
  return <CalculatorsSearchPageMockup />;
}
