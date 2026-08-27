import type { Metadata } from "next";

import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";

export const metadata: Metadata = {
  title: "Raise a referral — Ward Flow",
  description: "Synthetic front-door referral intake for the Ward Flow prototype.",
};

export default function ReferralIntakePage() {
  return <ReferralIntakeForm />;
}
