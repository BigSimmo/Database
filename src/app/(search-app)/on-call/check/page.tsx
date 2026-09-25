import type { Metadata } from "next";

import { OnCallCheckPage } from "@/components/on-call/on-call-check-page";

export const metadata: Metadata = {
  title: "Check these | On Call | PsychSift",
  description: "Your entries that have never been checked, are overdue, or come due in the next 30 days.",
};

export default function OnCallCheckRoute() {
  return <OnCallCheckPage />;
}
