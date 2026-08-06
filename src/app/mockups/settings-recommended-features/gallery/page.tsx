import type { Metadata } from "next";

import { SettingsRecommendedFeaturesMockupPage } from "@/components/settings-recommended-features-mockups";

export const metadata: Metadata = {
  title: "Recommended Settings Gallery Mockup - Clinical KB",
  description: "Full gallery of all recommended new settings options with what each adds.",
};

export default function SettingsRecommendedFeaturesGalleryMockupRoute() {
  return <SettingsRecommendedFeaturesMockupPage mode="gallery" />;
}
