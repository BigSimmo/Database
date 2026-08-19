import type { Metadata } from "next";

import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";

export const metadata: Metadata = {
  title: "Diagnostic Specifiers home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Diagnostic Specifiers home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function SpecifiersDetailedHomeMockupPage() {
  return <SpecifiersHomePage />;
}
