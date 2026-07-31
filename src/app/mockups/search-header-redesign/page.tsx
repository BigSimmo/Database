import type { Metadata } from "next";

import { SearchHeaderRedesignMockupsPage } from "@/components/search-header-redesign-mockups";

export const metadata: Metadata = {
  title: "Search header redesign - Clinical KB",
  description:
    "Four redesign directions for the shared search-results header, each showing desktop and phone in the same frame.",
};

export default function SearchHeaderRedesignMockupRoute() {
  return <SearchHeaderRedesignMockupsPage />;
}
