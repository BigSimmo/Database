import type { Metadata } from "next";

import { OnCallCalendarPage } from "@/components/on-call/on-call-calendar-page";

export const metadata: Metadata = {
  title: "Calendar | Roster | PsychSift",
  description: "Teaching sessions and recorded expiry dates, which you can add to your own calendar.",
};

// Moved from `/on-call/calendar` (`src/proxy.ts` redirects the old URL). The
// component underneath is still On Call's own — see
// `src/components/on-call/on-call-calendar-page.tsx` — this route move only
// relocates where the page lives, not who owns its content.
export default function RosterCalendarRoute() {
  return <OnCallCalendarPage />;
}
