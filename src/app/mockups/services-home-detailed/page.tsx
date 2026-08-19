import type { Metadata } from "next";

import { defaultServiceSlug } from "@/lib/services";
import { ServicesHomePage } from "@/components/services/services-home-page";

export const metadata: Metadata = {
  title: "Clinical Services home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Clinical Services home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default async function ServicesDetailedHomeMockupPage() {
  return <ServicesHomePage defaultServiceSlug={defaultServiceSlug() ?? null} />;
}
