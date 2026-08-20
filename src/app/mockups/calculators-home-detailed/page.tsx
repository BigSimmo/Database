import type { Metadata } from "next";

import { CalculatorsHomePage } from "@/components/calculators";

export const metadata: Metadata = {
  title: "Clinical Calculators home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Clinical Calculators home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function CalculatorsDetailedHomeMockupPage() {
  return <CalculatorsHomePage />;
}
