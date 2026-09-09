import type { Metadata } from "next";

import { TherapyNavigationRailMockups } from "@/components/therapy-navigation-mockups/rail";

export const metadata: Metadata = {
  title: "Therapy navigation A · Grouped rail - PsychSift",
  description:
    "Direction A for the Therapy navigation panel: three ranked groups on a rail, shown at desktop, tablet and phone.",
};

export default function TherapyNavigationRailMockupPage() {
  return <TherapyNavigationRailMockups />;
}
