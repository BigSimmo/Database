import type { Metadata } from "next";

import { RosterSettingsPage } from "@/components/roster/roster-settings-page";

export const metadata: Metadata = {
  title: "Settings | Roster | PsychSift",
  description: "Your calendar, shift reminder, workplaces, calendar links, and deleting your Roster data.",
};

export default function RosterSettingsRoute() {
  return <RosterSettingsPage />;
}
