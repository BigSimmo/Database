import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Ward Flow network diagram",
  description:
    "Schematic diagram of the synthetic statewide mental health service network: services as nodes, confirmed bed pressure as node fill, and open movements as catchment-to-destination routes.",
};

export default function WardNetworkPage() {
  return <WardModeWorkspace mode="network" />;
}
