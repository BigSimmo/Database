import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Playbook | On Call | PsychSift",
  description: "The escalation playbook: who to call, when, and links to your own guideline documents.",
};

export default function OnCallPlaybookRoute() {
  return <OnCallSectionPage section="playbook" />;
}
