import type { Metadata } from "next";

import { RosterShiftsPage } from "@/components/roster/roster-shifts-page";

export const metadata: Metadata = {
  title: "Shifts | Roster | PsychSift",
  description: "Your shifts by week and month, and your rostered hours, private to your account.",
};

export default function RosterShiftsRoute() {
  return <RosterShiftsPage />;
}
