import type { Metadata } from "next";

import { CalculatorsShowAllDirectionsMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Show all buttons - Clinical KB",
  description: "Three phone mockups of the Calculators home that differ only in the Show all button style.",
};

export default function CalculatorsShowAllMockupRoute() {
  return <CalculatorsShowAllDirectionsMockup />;
}
