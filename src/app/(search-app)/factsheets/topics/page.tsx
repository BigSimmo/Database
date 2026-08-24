import type { Metadata } from "next";

import { FactsheetsTopicsPage } from "@/components/factsheets/factsheets-topics-page";

export const metadata: Metadata = {
  title: "Factsheet topics | Clinical KB",
  description: "Browse patient information factsheets organised by topic.",
};

export default function FactsheetsTopicsRoute() {
  return <FactsheetsTopicsPage />;
}
