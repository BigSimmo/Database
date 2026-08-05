import type { Metadata } from "next";

import { PhoneModeSheetYesMockups } from "@/components/phone-mode-sheet-yes-mockups";

export const metadata: Metadata = {
  title: "Phone mode sheet YES mockups - Clinical KB",
  description:
    "Design review of the phone Choose mode sheet plus two polished large YES comps: sectioned list and icon deck.",
};

export default function PhoneModeSheetYesMockupPage() {
  return <PhoneModeSheetYesMockups />;
}
