import type { Metadata } from "next";

import { OnCallWhosOnPage } from "@/components/on-call/whos-on/whos-on-page";

export const metadata: Metadata = {
  title: "Who's on | On Call | PsychSift",
  description: "Who is rostered on, by team, for yesterday, today and tomorrow.",
};

export default function OnCallWhosOnRoute() {
  return <OnCallWhosOnPage />;
}
