import type { Metadata } from "next";

import { FactsheetsHomePage } from "@/components/factsheets/factsheets-home-page";

export const metadata: Metadata = {
  title: "Patient Factsheets home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Patient Factsheets home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function FactsheetsDetailedHomeMockupPage() {
  return <FactsheetsHomePage />;
}
