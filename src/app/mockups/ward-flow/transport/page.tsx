import type { Metadata } from "next";

import { LiveTracker } from "@/components/ward-management/tracker/live-tracker";

export const metadata: Metadata = {
  title: "Transport - Ward Flow",
  description: "Synthetic coordinator's view of every vehicle in transit: which patient, which leg, how long since.",
};

export default function WardTransportPage() {
  return <LiveTracker />;
}
