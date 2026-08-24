import type { Metadata } from "next";

import { TherapyCompareProgressiveMockups } from "@/components/therapy-compare-picker-mockups/progressive";

export const metadata: Metadata = {
  title: "Therapy comparison picker A · Add as you go - Clinical KB",
  description: "Direction A for the phone therapy-comparison picker: Add as you go, shown as a live phone prototype.",
};

export default function TherapyCompareProgressiveMockupPage() {
  return <TherapyCompareProgressiveMockups />;
}
