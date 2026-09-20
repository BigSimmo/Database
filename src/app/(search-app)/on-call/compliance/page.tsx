import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  title: "Compliance | On Call | PsychSift",
  // Says what the page is and, in the same breath, what it is not. The
  // description is the one line a search result or a shared link shows, so the
  // "not a check" half cannot be left to the page body.
  description:
    "The requirements you keep current — registration, indemnity, credentialing, training — grouped by what happens if they lapse. Your own recorded dates, never a check with the issuing body.",
};

export default function OnCallComplianceRoute() {
  return <OnCallSectionPage view="compliance" />;
}
