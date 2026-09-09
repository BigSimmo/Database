import type { Metadata } from "next";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";

export const metadata: Metadata = {
  title: "Movements - Ward Flow",
  description: "Synthetic six-stage mental health patient-movement board.",
};

export default function WardMovementsPage() {
  return <MovementsScreen />;
}
