import type { Metadata } from "next";

import { FactsheetsHomePage } from "@/components/factsheets/factsheets-home-page";

export const metadata: Metadata = {
  title: "Patient Information Sheets | Clinical KB",
  description: "Browse patient information sheet layouts and approved local resources.",
};

export default function FactsheetsPage() {
  return <FactsheetsHomePage />;
}
