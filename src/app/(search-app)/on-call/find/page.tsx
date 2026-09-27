import type { Metadata } from "next";

import { OnCallFindPage } from "@/components/on-call/find/find-page";

export const metadata: Metadata = {
  title: "Find | On Call | PsychSift",
  description: "Wards, equipment, manuals and the plan for when systems go down, for your hospital.",
};

export default function OnCallFindRoute() {
  return <OnCallFindPage />;
}
