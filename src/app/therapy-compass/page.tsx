import type { Metadata } from "next";

import { TherapyCompassPage } from "@/components/therapy-compass";

export const metadata: Metadata = {
  title: "Therapy Compass - Clinical KB",
  description:
    "Source-grounded therapy decision support: search, compare, recommend, pathways, brief interventions and patient sheets.",
};

export default function TherapyCompassRoute() {
  return <TherapyCompassPage />;
}
