import type { Metadata } from "next";

import { OnCallCallNowPage } from "@/components/on-call/on-call-call-now-page";

export const metadata: Metadata = {
  title: "Who to call now | On Call | PsychSift",
  description: "Pick the situation and get its escalation steps, with the steps for this hour first.",
};

export default function OnCallCallNowRoute() {
  return <OnCallCallNowPage />;
}
