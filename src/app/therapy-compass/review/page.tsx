import type { Metadata } from "next";

import { OtherScreen } from "@/components/therapy-compass/screens/other-screen";

export const metadata: Metadata = {
  title: "Review queue - Therapy mode",
  description: "Therapy records still awaiting qualified-clinician source review.",
};

export default function TherapyCompassReviewRoute() {
  return <OtherScreen />;
}
