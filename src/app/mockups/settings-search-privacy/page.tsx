import type { Metadata } from "next";

import { SettingsSearchMockupPage } from "@/components/settings-search-mockups";

export const metadata: Metadata = {
  title: "Search Settings Privacy Mockup - Clinical KB",
  description: "Search-first ChatGPT-style privacy and personalization settings mockup for Clinical KB.",
};

export default function SettingsSearchPrivacyMockupRoute() {
  return <SettingsSearchMockupPage variant="privacy" />;
}
