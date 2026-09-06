import type { Metadata } from "next";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";

export const metadata: Metadata = {
  title: "Delays — Ward Flow",
  description:
    "Synthetic prototype: why each waiting patient is still waiting. Merges the former priority queue, exceptions inbox and escalation board into one list, grouped by cause.",
};

export default function WardDelaysPage() {
  return <DelaysScreen />;
}
