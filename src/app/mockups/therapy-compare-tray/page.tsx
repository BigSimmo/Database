import type { Metadata } from "next";

import { TherapyCompareTrayMockups } from "@/components/therapy-compare-picker-mockups/tray";

export const metadata: Metadata = {
  title: "Therapy comparison picker C · Carry a compare tray - Clinical KB",
  description:
    "Direction C for the phone therapy-comparison picker: Carry a compare tray, shown as a live phone prototype.",
};

export default function TherapyCompareTrayMockupPage() {
  return <TherapyCompareTrayMockups />;
}
