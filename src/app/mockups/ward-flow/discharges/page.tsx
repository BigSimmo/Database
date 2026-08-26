import type { Metadata } from "next";

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";

export const metadata: Metadata = {
  title: "Discharges — Ward Flow",
  description: "Synthetic, live discharge and egress board for the Ward Flow prototype — blocked releases first.",
};

export default function WardDischargesPage() {
  return <DischargeBoard />;
}
