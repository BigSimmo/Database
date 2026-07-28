import type { Metadata } from "next";

import { CalculatorsClinicalConsoleMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Clinical Console Mockup - Clinical KB",
  description: "Split-pane psychiatry calculator console with a live score ticker for Clinical KB.",
};

export default function CalculatorsClinicalConsoleMockupRoute() {
  return <CalculatorsClinicalConsoleMockup />;
}
