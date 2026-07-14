import type { Metadata } from "next";

import { TherapyCompassPage } from "@/components/therapy-compass";

export const metadata: Metadata = {
  title: "Therapy Compass Mockup - Clinical KB",
  description:
    "Source-grounded therapy decision-support mockup: search, compare, recommend, pathways, brief interventions and patient sheets.",
};

export default function TherapyCompassMockupRoute() {
  return <TherapyCompassPage />;
}
