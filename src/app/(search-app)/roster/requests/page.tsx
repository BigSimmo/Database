import type { Metadata } from "next";

import { RosterRequestsPage } from "@/components/roster/requests/roster-requests-page";

export const metadata: Metadata = {
  title: "Requests | Roster | PsychSift",
  description: "Swap or give away a shift, set dates you cannot work, and plan leave.",
};

export default function RosterRequestsRoute() {
  return <RosterRequestsPage />;
}
