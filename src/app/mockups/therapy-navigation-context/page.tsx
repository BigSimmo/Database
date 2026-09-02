import type { Metadata } from "next";

import { TherapyNavigationContextMockups } from "@/components/therapy-navigation-mockups/context";

export const metadata: Metadata = {
  title: "Therapy navigation B · Context row - PsychSift",
  description:
    "Direction B for the Therapy navigation panel: a two-line context row with a weighted stage track and a jump panel, shown at desktop, tablet and phone.",
};

export default function TherapyNavigationContextMockupPage() {
  return <TherapyNavigationContextMockups />;
}
