import type { Metadata } from "next";

import { PrivacyQuietSignalPage } from "@/components/privacy-quiet-signal-page";

export const metadata: Metadata = {
  title: "How PsychSift handles your data",
  description: "Learn what PsychSift processes, where data is handled, and how long information is retained.",
};

/**
 * Privacy page: compact sticky navigation, in-flow safety and processing overview,
 * accordion with gists, and desktop section index. Governance wording
 * lives in `src/lib/privacy-page-content.tsx` (pinned by `tests/privacy-ui.test.ts`).
 */
export default function PrivacyPage() {
  return <PrivacyQuietSignalPage />;
}
