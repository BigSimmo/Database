import type { Metadata } from "next";

import { OnCallShiftCoverMockups } from "@/components/on-call-shift-cover-mockups";

export const metadata: Metadata = {
  title: "On Call shift and cover mockups - PsychSift",
  description:
    "Four boards rebuilding the On Call home, contacts row, escalation ladder and printed pocket card against findings from the shipped hub.",
};

export default function OnCallShiftCoverMockupRoute() {
  return <OnCallShiftCoverMockups />;
}
