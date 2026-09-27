import type { Metadata } from "next";

import { CmeCustomisePage } from "@/components/cme/cme-customise-page";

export const metadata: Metadata = {
  title: "Customise | CPD | PsychSift",
  description: "Choose what shows on your CPD dashboard, and in what order.",
};

export default function CmeCustomiseRoute() {
  return <CmeCustomisePage />;
}
