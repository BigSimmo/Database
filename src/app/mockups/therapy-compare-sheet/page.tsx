import type { Metadata } from "next";

import { TherapyCompareSheetMockups } from "@/components/therapy-compare-picker-mockups/sheet";

export const metadata: Metadata = {
  title: "Therapy comparison picker B · Build the set in one sheet - Clinical KB",
  description:
    "Direction B for the phone therapy-comparison picker: Build the set in one sheet, shown as a live phone prototype.",
};

export default function TherapyCompareSheetMockupPage() {
  return <TherapyCompareSheetMockups />;
}
