import type { Metadata } from "next";

import { loadActReferenceGroups, loadChiefPsychiatristStandards } from "@/components/forms/act-and-standards-content";
import { ActAndStandardsPage } from "@/components/forms/act-and-standards-page";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";
import { mhaActMetadata } from "@/lib/mha-act-sections";

export const metadata: Metadata = {
  title: "Act and Standards | PsychSift",
  description:
    "Plain-English summaries of the Mental Health Act 2014 (WA) sections and the Chief Psychiatrist's Standards for Clinical Care.",
};

// Prerendered at build, where the repository's data/ directory is present. The
// Standards file is read from disk (it may not exist yet), and the runtime image does
// not ship data/, so this page must never render per request.
export const dynamic = "force-static";

export default function FormsActAndStandardsRoute() {
  return (
    <ActAndStandardsPage
      act={mhaActMetadata}
      groups={loadActReferenceGroups()}
      standards={loadChiefPsychiatristStandards()}
      backHref={consolidatedModeSearchPath("forms")}
    />
  );
}
