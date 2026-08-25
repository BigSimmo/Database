import type { Metadata } from "next";

import { EscalationBoardPage } from "@/components/ward-management/escalation/escalation-board";

export const metadata: Metadata = {
  title: "Escalation board — Ward Flow",
  description:
    "Synthetic prototype: one place showing every Ward Flow patient whose placement has gone wrong. Records and shows only — it suggests nothing.",
};

export default function WardEscalationPage() {
  return <EscalationBoardPage />;
}
