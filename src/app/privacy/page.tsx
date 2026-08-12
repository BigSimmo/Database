import type { Metadata } from "next";

import { PrivacyQuietSignalPage } from "@/components/privacy-quiet-signal-page";

export const metadata: Metadata = {
  title: "Privacy & data handling — Clinical KB",
  description: "Draft product information about how Clinical KB handles questions and documents.",
};

/**
 * Quiet Signal privacy page: sticky Important, processing map, accordion with
 * gists, desktop Signal Index — no phone number-chip strip. Governance wording
 * lives in `src/lib/privacy-page-content.tsx` (pinned by `tests/privacy-ui.test.ts`).
 */
export default function PrivacyPage() {
  return <PrivacyQuietSignalPage />;
}
