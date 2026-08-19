import type { Metadata } from "next";

import { defaultFormSlug } from "@/lib/forms";
import { FormsHomePage } from "@/components/forms/forms-home-page";

export const metadata: Metadata = {
  title: "Clinical Forms home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Clinical Forms home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default async function FormsDetailedHomeMockupPage() {
  return <FormsHomePage defaultFormSlug={defaultFormSlug() ?? null} />;
}
