import type { Metadata } from "next";

import { OnCallCard } from "@/components/on-call/on-call-card";

export const metadata: Metadata = {
  title: "Essentials card | On Call | PsychSift",
  description: "A one-page printable card of the numbers flagged for it — personal numbers and stale entries excluded.",
};

export default function OnCallCardRoute() {
  return <OnCallCard />;
}
