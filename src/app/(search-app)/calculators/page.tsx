import type { Metadata } from "next";

import { CalculatorsSearchPage } from "@/components/calculators";

export const metadata: Metadata = {
  title: "Calculators - Clinical KB",
  description:
    "Psychiatry clinical decision calculators and rating scales with source-cited scoring guidance.",
};

export default function CalculatorsRoute() {
  return <CalculatorsSearchPage />;
}
