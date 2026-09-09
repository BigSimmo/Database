import type { Metadata } from "next";

import { SettingsSearchMockupPage } from "@/components/settings-search-mockups";

export const metadata: Metadata = {
  title: "Search Settings General Mockup - PsychSift",
  description: "Search-first ChatGPT-style general settings mockup for PsychSift.",
};

export default function SettingsSearchGeneralMockupRoute() {
  return <SettingsSearchMockupPage variant="general" />;
}
