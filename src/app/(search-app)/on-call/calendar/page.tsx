import type { Metadata } from "next";

import { OnCallCalendarPage } from "@/components/on-call/on-call-calendar-page";

export const metadata: Metadata = {
  title: "Calendar | On Call | PsychSift",
  description: "Teaching sessions and recorded expiry dates, which you can add to your own calendar.",
};

export default function OnCallCalendarRoute() {
  return <OnCallCalendarPage />;
}
