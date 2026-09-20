import type { Metadata } from "next";

import { CmeSetupPage } from "@/components/cme/cme-setup-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

export const metadata: Metadata = {
  title: "Set up | CME | PsychSift",
  description: "Four things to set up once, then the mode runs itself.",
};

export default function CmeSetupRoute() {
  return <CmeSetupPage set={DEMO_CME_YEAR} />;
}
