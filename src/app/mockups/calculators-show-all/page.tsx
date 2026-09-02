import type { Metadata } from "next";

import { CalculatorsShowAllDirectionsMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Show all buttons - PsychSift",
  description:
    "Recommended Show all chip plus two polished phone alternatives. The homes are identical except the chip.",
};

export default function CalculatorsShowAllMockupRoute() {
  return <CalculatorsShowAllDirectionsMockup />;
}
