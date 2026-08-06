import type { Metadata } from "next";

import { SettingsRecommendedFeaturesMockupPage } from "@/components/settings-recommended-features-mockups";

export const metadata: Metadata = {
  title: "Recommended Settings Features Mockup - Clinical KB",
  description:
    "Phone and desktop mockups for recommended new settings options, organised by source, reading, workflow, privacy, productivity, and accessibility.",
};

export default function SettingsRecommendedFeaturesMockupRoute() {
  return <SettingsRecommendedFeaturesMockupPage initialGroupId="source-evidence" />;
}
