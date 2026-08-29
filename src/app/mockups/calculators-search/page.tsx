import type { Metadata } from "next";

import { CalculatorsSearchDetailMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Search Mockup - PsychSift",
  description:
    "Search-first psychiatry calculators page with individual calculator detail view and score-linked next clinical actions for PsychSift.",
};

export default function CalculatorsSearchMockupRoute() {
  return <CalculatorsSearchDetailMockup />;
}
