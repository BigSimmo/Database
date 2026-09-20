import type { Metadata } from "next";

import { CmeProgrammePage } from "@/components/cme/cme-programme-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

export const metadata: Metadata = {
  title: "Programme | CME | PsychSift",
  description: "The targets you confirmed for this year, and the document you confirmed them against.",
};

export default function CmeProgrammeRoute() {
  return <CmeProgrammePage set={DEMO_CME_YEAR} />;
}
