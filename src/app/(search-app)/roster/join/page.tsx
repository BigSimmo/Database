import type { Metadata } from "next";

import { RosterJoinPage } from "@/components/roster/invite/roster-join-page";

export const metadata: Metadata = {
  title: "Join a team | Roster | PsychSift",
  description: "Join a confirmed team roster with an invite from your manager.",
};

export default function Page() {
  return <RosterJoinPage />;
}
