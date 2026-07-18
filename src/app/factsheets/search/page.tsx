import type { Metadata } from "next";

import { FactsheetsSearchPage } from "@/components/factsheets/factsheets-search-page";

export const metadata: Metadata = { title: "Search Patient Information | Clinical KB" };

export default function FactsheetsSearchRoute() {
  return <FactsheetsSearchPage />;
}
