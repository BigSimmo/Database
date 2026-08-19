import type { Metadata } from "next";

import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

export const metadata: Metadata = {
  title: "Differential Diagnosis home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Differential Diagnosis home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function DifferentialsDetailedHomeMockupPage() {
  return <DifferentialsHomePage />;
}
