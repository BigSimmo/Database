import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Priority queue - Ward Flow",
  description: "Synthetic operational priority queue for mental health patient movement.",
};

export default function WardQueuePage() {
  return <WardModeWorkspace mode="queue" />;
}
