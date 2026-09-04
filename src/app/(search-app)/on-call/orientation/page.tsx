import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Orientation | On Call | PsychSift",
  description: "Orientation manuals held as documents, each optionally carrying your own pinned summary.",
};

export default function OnCallOrientationRoute() {
  return <OnCallSectionPage section="orientation" />;
}
