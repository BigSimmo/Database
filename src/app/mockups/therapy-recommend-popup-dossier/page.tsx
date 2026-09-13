import type { Metadata } from "next";

import { TherapyRecommendPopupDossierMockup } from "@/components/therapy-recommend-popup-mockups/dossier";

export const metadata: Metadata = {
  title: "Therapy Recommend popup A · Clinical record dialog - PsychSift",
  description:
    "Direction A for the Therapy Recommend popup: one centred dialog with tabs and a pinned action bar, shown at desktop and phone.",
};

export default function TherapyRecommendPopupDossierMockupPage() {
  return <TherapyRecommendPopupDossierMockup />;
}
