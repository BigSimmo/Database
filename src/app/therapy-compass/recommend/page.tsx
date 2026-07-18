import type { Metadata } from "next";

import { RecommendScreen } from "@/components/therapy-compass/screens/recommend-screen";

export const metadata: Metadata = {
  title: "Recommend a therapy - Therapy Compass",
  description: "Match a clinical question and constraints to ranked, source-grounded therapy options.",
};

export default function TherapyCompassRecommendRoute() {
  return <RecommendScreen />;
}
