"use client";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

/** On Call's Compliance page, moved to Admin whole: same four bands, same wording, same editor. */
export function AdminRenewalsPage() {
  return (
    <OnCallSectionPage
      view="compliance"
      chrome={{
        title: "Renewals",
        modeIdentity: "my-work",
        testId: "admin-renewals-main",
        floatingAdd: { label: "Add a renewal", testId: "admin-renewals-add" },
      }}
    />
  );
}
