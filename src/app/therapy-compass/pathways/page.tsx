import type { Metadata } from "next";

import { PathwaysScreen } from "@/components/therapy-compass/screens/pathways-screen";

export const metadata: Metadata = {
  title: "Clinical pathways - Therapy mode",
  description: "Problem-based, step-by-step therapy pathways linking source-grounded therapy records.",
};

export default function TherapyCompassPathwaysRoute() {
  return <PathwaysScreen />;
}
