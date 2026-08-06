import type { Metadata } from "next";

import { PhoneModeSheetYesMockups } from "@/components/phone-mode-sheet-yes-mockups";

export const metadata: Metadata = {
  title: "Phone mode sheet glance YES comps - Clinical KB",
  description:
    "New phone Choose mode sheet YES comps: dense title list and flat icon tiles, without Find/Diagnose/Care organisation.",
};

export default function PhoneModeSheetYesMockupPage() {
  return <PhoneModeSheetYesMockups />;
}
