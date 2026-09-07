import type { Metadata } from "next";

import { TherapyScenarioPopupLiveMockup } from "@/components/therapy-scenario-popup-mockups/live";

export const metadata: Metadata = {
  title: "Therapy Recommend scenario popup 2 · Docked live composer - PsychSift",
  description:
    "Direction 2 for the Recommend clinical-situation popup: a docked composer with per-chip deltas and a list that re-ranks live, shown at desktop and phone.",
};

export default function TherapyScenarioPopupLiveMockupPage() {
  return <TherapyScenarioPopupLiveMockup />;
}
