import type { Metadata } from "next";

import { OnCallReferPage } from "@/components/on-call/refer/refer-page";

export const metadata: Metadata = {
  title: "Refer | On Call | PsychSift",
  description: "How to refer to each service at your hospital, and your own referral notes.",
};

export default function OnCallReferRoute() {
  return <OnCallReferPage />;
}
