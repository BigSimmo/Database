import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Action inbox - Ward Flow",
  description: "Synthetic owned exceptions and timing view for mental health patient flow.",
};

export default function WardExceptionsPage() {
  return <WardModeWorkspace mode="exceptions" />;
}
