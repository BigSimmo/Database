import type { Metadata } from "next";

import { PrivacyLiveSignalVariantsMockups } from "@/components/privacy-live-signal-variants-mockups";

export const metadata: Metadata = {
  title: "Privacy Live Signal variants - Clinical KB",
  description: "Three perfected Live Signal privacy-page variants without the phone top number chip navigation.",
};

export default function PrivacyLiveSignalVariantsMockupPage() {
  return <PrivacyLiveSignalVariantsMockups />;
}
