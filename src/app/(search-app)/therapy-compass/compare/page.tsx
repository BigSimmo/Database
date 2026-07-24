import type { Metadata } from "next";

import { CompareScreen } from "@/components/therapy-compass/screens/compare-screen";

export const metadata: Metadata = {
  title: "Compare therapies - Therapy mode",
  description: "Compare therapies side by side on indications, delivery, evidence, and review status.",
};

export default function TherapyCompassCompareRoute() {
  return <CompareScreen />;
}
