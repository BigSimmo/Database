import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Transport - Ward Flow",
  description: "Synthetic legal, document, booking and handover transport-readiness view.",
};

export default function WardTransportPage() {
  return <WardModeWorkspace mode="transport" />;
}
