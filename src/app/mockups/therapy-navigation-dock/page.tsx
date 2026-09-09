import type { Metadata } from "next";

import { TherapyNavigationDockMockups } from "@/components/therapy-navigation-mockups/dock";

export const metadata: Metadata = {
  title: "Therapy navigation C · Working-set dock - PsychSift",
  description:
    "Direction C for the Therapy navigation panel: navigation as a readout of the therapy, basket and artifacts you are carrying, shown at desktop, tablet and phone.",
};

export default function TherapyNavigationDockMockupPage() {
  return <TherapyNavigationDockMockups />;
}
