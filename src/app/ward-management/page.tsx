import type { Metadata } from "next";

import { WardManagementConsole } from "@/components/ward-management/ward-management-console";

export const metadata: Metadata = {
  title: "Ward Flow - Clinical KB",
  description: "Synthetic WA psychiatry patient-flow and ward-capacity coordination prototype.",
};

export default function WardManagementPage() {
  return <WardManagementConsole />;
}
