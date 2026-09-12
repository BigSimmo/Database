import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Who's who | On Call | PsychSift",
  description: "What each on-call role does, when to call them, and the acronyms this service uses.",
};

export default function OnCallWhoIsWhoRoute() {
  return <OnCallSectionPage view="who-is-who" />;
}
