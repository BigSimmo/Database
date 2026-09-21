import type { Metadata } from "next";

import { OnCallCalendarsMockups } from "@/components/on-call-calendars-mockups";

export const metadata: Metadata = {
  title: "On Call calendars mockups - PsychSift",
  description:
    "Four proposed On Call surfaces: a cover calendar, a teaching term with attendance, a de-identified shift log, and the referrals list asked as a question.",
};

export default function OnCallCalendarsMockupRoute() {
  return <OnCallCalendarsMockups />;
}
