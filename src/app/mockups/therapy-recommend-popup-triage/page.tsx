import type { Metadata } from "next";

import { TherapyRecommendPopupTriageMockup } from "@/components/therapy-recommend-popup-mockups/triage";

export const metadata: Metadata = {
  title: "Therapy Recommend popup B · Docked triage panel - PsychSift",
  description:
    "Direction B for the Therapy Recommend popup: a docked panel beside the ranking with a match stepper and a live fit check, shown at desktop and phone.",
};

export default function TherapyRecommendPopupTriageMockupPage() {
  return <TherapyRecommendPopupTriageMockup />;
}
