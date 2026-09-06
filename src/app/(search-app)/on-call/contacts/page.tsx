import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Contacts | On Call | PsychSift",
  description: "On-call contacts filed by role, so entries survive rotations.",
};

export default function OnCallContactsRoute() {
  return <OnCallSectionPage section="contacts" />;
}
