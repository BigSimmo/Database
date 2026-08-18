import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Governance - Ward Flow",
  description: "Synthetic AI assurance, audit and data-boundary view for Ward Flow.",
};

export default function WardGovernancePage() {
  return <WardModeWorkspace mode="governance" />;
}
