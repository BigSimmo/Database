import type { Metadata } from "next";

import { OnCallShiftsPage } from "@/components/on-call/on-call-shifts-page";

export const metadata: Metadata = {
  title: "My shifts | On Call | PsychSift",
  description: "Your own roster, private to your account, with your next shift at the top of On Call.",
};

export default function OnCallShiftsRoute() {
  return <OnCallShiftsPage />;
}
