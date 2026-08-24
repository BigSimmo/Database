import type { Metadata } from "next";

import { CalculatorsShowAllDirectionsMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Show all directions - Clinical KB",
  description:
    "Four directions for a Calculators home Show all chip, rebuilt from the Tools launcher grammar with tighter colour, padding, and symmetry.",
};

export default function CalculatorsShowAllMockupRoute() {
  return <CalculatorsShowAllDirectionsMockup />;
}
