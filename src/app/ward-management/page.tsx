import type { Metadata } from "next";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";

export const metadata: Metadata = {
  title: "Ward Flow",
  description:
    "Flow coordinator view: emergency department pressure, the priority queue, statewide flow and the explainable shortlist for one synthetic movement.",
};

export default function WardManagementPage() {
  return <CoordinatorScreen />;
}
