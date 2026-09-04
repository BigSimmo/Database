import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Teaching | On Call | PsychSift",
  description: "The teaching calendar: what, when, who is presenting, and a link to the recording.",
};

export default function OnCallEducationRoute() {
  return <OnCallSectionPage section="education" />;
}
