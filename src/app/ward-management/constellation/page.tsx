import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Operational constellation - Ward Flow",
  description: "Synthetic full-screen statewide mental health patient-flow constellation.",
};

export default function WardConstellationPage() {
  return <WardModeWorkspace mode="constellation" />;
}
