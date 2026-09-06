import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Referrals | On Call | PsychSift",
  description: "Your own referral list: who a service accepts, catchment, hours and how to refer.",
};

export default function OnCallReferralsRoute() {
  return <OnCallSectionPage section="referrals" />;
}
