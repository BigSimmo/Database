import type { Metadata } from "next";

import { TherapyComparePerfectedMockups } from "@/components/therapy-compare-picker-mockups/tray-perfected";

export const metadata: Metadata = {
  title: "Therapy comparison picker C+ · Perfected tray - Clinical KB",
  description:
    "The perfected compare-tray direction: no tray until a set exists, one bottom stack that hides with the composer, and adding from a therapy record.",
};

export default function TherapyComparePerfectedMockupPage() {
  return <TherapyComparePerfectedMockups />;
}
