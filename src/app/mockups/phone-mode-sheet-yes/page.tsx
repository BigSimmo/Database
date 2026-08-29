import type { Metadata } from "next";

import { PhoneModeSheetYesMockups } from "@/components/phone-mode-sheet-yes-mockups";

export const metadata: Metadata = {
  title: "Phone mode sheet YES 01 perfected - PsychSift",
  description:
    "Perfected phone Choose mode sheet: sectioned clinical list with all review findings closed, plus the icon-deck alternate.",
};

export default function PhoneModeSheetYesMockupPage() {
  return <PhoneModeSheetYesMockups />;
}
