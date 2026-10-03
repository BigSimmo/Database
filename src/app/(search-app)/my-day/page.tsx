import type { Metadata } from "next";

import { MyDayPage } from "@/components/my-day/my-day-page";

export const metadata: Metadata = {
  title: "My Day | PsychSift",
  description:
    "One list of what needs you across On Call, Roster, CPD, Teaching and Admin: overdue first, then due soon, then the rest.",
};

/** My Day (mode id `my-day`): a read-only merged list with no search surface. */
export default function MyDayRoute() {
  return <MyDayPage />;
}
