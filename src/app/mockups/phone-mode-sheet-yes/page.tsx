import type { Metadata } from "next";

import { PhoneModeSheetYesMockups } from "@/components/phone-mode-sheet-yes-mockups";

export const metadata: Metadata = {
  title: "Phone mode sheet dense glance list - Clinical KB",
  description:
    "Phone Choose mode sheet redesigned for glance picking: dense flat list without Find/Diagnose/Care organisation.",
};

export default function PhoneModeSheetYesMockupPage() {
  return <PhoneModeSheetYesMockups />;
}
