import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Logistics | On Call | PsychSift",
  description: "Parking, after-hours food, call rooms, IT, rostering, payroll and leave.",
};

export default function OnCallLogisticsRoute() {
  return <OnCallSectionPage section="logistics" />;
}
