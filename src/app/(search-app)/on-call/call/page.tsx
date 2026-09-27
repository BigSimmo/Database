import type { Metadata } from "next";

import { OnCallCallPage } from "@/components/on-call/call/call-page";

export const metadata: Metadata = {
  title: "Call | On Call | PsychSift",
  description:
    "Your hospital's numbers by area, outside lines and your own numbers, each with the date it was updated.",
};

export default function OnCallCallRoute() {
  return <OnCallCallPage />;
}
