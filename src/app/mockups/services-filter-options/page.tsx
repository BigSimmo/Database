import type { Metadata } from "next";

import { ServicesFilterOptionsMockupsPage } from "@/components/services-filter-options-mockups";

export const metadata: Metadata = {
  title: "Services filter · three options - PsychSift",
  description:
    "Round two of the services filter study: the fix that can ship now, the recommended build, and the bolder move that evicts presets from the sheet — at desktop and phone.",
};

export default function ServicesFilterOptionsMockupPage() {
  return <ServicesFilterOptionsMockupsPage />;
}
