import type { Metadata } from "next";

import { TherapyScenarioPopupIntakeMockup } from "@/components/therapy-scenario-popup-mockups/intake";

export const metadata: Metadata = {
  title: "Therapy Recommend scenario popup 3 · Structured intake - PsychSift",
  description:
    "Direction 3 for the Recommend clinical-situation popup: structured pickers that compose an editable scenario sentence, shown at desktop and phone.",
};

export default function TherapyScenarioPopupIntakeMockupPage() {
  return <TherapyScenarioPopupIntakeMockup />;
}
