import type { Metadata } from "next";

import { CalculatorsGuidedFlowMockup } from "@/components/calculator-mockups";

export const metadata: Metadata = {
  title: "Calculators Guided Flow Mockup - PsychSift",
  description: "Phone-first one-question-at-a-time psychiatry calculator flow for PsychSift.",
};

export default function CalculatorsGuidedFlowMockupRoute() {
  return <CalculatorsGuidedFlowMockup />;
}
