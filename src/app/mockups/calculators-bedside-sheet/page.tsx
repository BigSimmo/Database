import type { Metadata } from "next";

import { CalculatorsBedsideSheetMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Bedside Sheet Mockup - Clinical KB",
  description: "Multi-scale bedside assessment sheet with a running session summary for Clinical KB.",
};

export default function CalculatorsBedsideSheetMockupRoute() {
  return <CalculatorsBedsideSheetMockup />;
}
