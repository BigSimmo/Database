import type { Metadata } from "next";

import { SettingsSearchMockupPage } from "@/components/settings-search-mockups";

export const metadata: Metadata = {
  title: "Premium Account Hub Mockup - Clinical KB",
  description: "Premium ChatGPT-style account and app hub settings mockup for Clinical KB.",
};

export default function PremiumAccountHubMockupRoute() {
  return <SettingsSearchMockupPage variant="premium" />;
}
