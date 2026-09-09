import type { Metadata } from "next";

import { TherapyRecommendPopupWorkbenchMockup } from "@/components/therapy-recommend-popup-mockups/workbench";

export const metadata: Metadata = {
  title: "Therapy Recommend popup C · Consult workbench - PsychSift",
  description:
    "Direction C for the Therapy Recommend popup: a two-column dialog pairing the record with a plan and note builder, shown at desktop and phone.",
};

export default function TherapyRecommendPopupWorkbenchMockupPage() {
  return <TherapyRecommendPopupWorkbenchMockup />;
}
