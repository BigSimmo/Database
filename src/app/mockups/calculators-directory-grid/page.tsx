import type { Metadata } from "next";

import { CalculatorsDirectoryGridMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Directory Grid Mockup - Clinical KB",
  description: "Searchable psychiatry calculator directory with expand-in-place scoring for Clinical KB.",
};

export default function CalculatorsDirectoryGridMockupRoute() {
  return <CalculatorsDirectoryGridMockup />;
}
