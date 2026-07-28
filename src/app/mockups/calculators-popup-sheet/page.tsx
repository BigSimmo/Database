import type { Metadata } from "next";

import { CalculatorsPopupSheetMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Popup Sheet Mockup - Clinical KB",
  description:
    "Search-first psychiatry calculators page where each calculator opens as a desktop dialog or mobile bottom sheet for Clinical KB.",
};

export default function CalculatorsPopupSheetMockupRoute() {
  return <CalculatorsPopupSheetMockup />;
}
