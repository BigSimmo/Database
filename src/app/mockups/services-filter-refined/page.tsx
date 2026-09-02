import type { Metadata } from "next";

import { ServicesFilterRefinedMockupsPage } from "@/components/services-filter-refined-mockups";

export const metadata: Metadata = {
  title: "Services filter · three directions - PsychSift",
  description:
    "Three redesign directions for the services filter sheet, at desktop and phone, with live facet counts from the 219-service catalogue snapshot.",
};

export default function ServicesFilterRefinedMockupPage() {
  return <ServicesFilterRefinedMockupsPage />;
}
