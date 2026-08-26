import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Movements - Ward Flow",
  description: "Synthetic six-stage mental health patient-movement board.",
};

export default function WardMovementsPage() {
  return <WardModeWorkspace mode="movements" />;
}
