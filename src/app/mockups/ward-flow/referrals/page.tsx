import type { Metadata } from "next";

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";

export const metadata: Metadata = {
  title: "Referral board — Ward Flow",
  description:
    "Synthetic prototype: the coordinator's referral board and match view for the Ward Flow front door — queued referrals first, then recently decided, and a full-network match view for every unit.",
};

export default function WardReferralBoardPage() {
  return <ReferralBoard />;
}
