import type { Metadata } from "next";

import { SettingsSearchMockupPage } from "@/components/settings-search-mockups";

export const metadata: Metadata = {
  title: "Search Settings Clinical Mockup - Clinical KB",
  description: "Search-first ChatGPT-style clinical defaults settings mockup for Clinical KB.",
};

export default function SettingsSearchClinicalMockupRoute() {
  return <SettingsSearchMockupPage variant="clinical" />;
}
