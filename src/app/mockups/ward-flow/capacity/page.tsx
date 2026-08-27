import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Capacity - Ward Flow",
  description: "Synthetic ward-confirmed mental health bed-state and capability view.",
};

export default function WardCapacityPage() {
  return <WardModeWorkspace mode="capacity" />;
}
