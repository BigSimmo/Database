import type { Metadata } from "next";

import { TherapyScenarioPopupGuidedMockup } from "@/components/therapy-scenario-popup-mockups/guided";

export const metadata: Metadata = {
  title: "Therapy Recommend scenario popup 1 · Guided builder - PsychSift",
  description:
    "Direction 1 for the Recommend clinical-situation popup: a stepped builder with a live records-in-scope count, shown at desktop and phone.",
};

export default function TherapyScenarioPopupGuidedMockupPage() {
  return <TherapyScenarioPopupGuidedMockup />;
}
