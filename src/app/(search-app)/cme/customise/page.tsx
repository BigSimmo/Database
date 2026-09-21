import type { Metadata } from "next";

import { CmeCustomisePage } from "@/components/cme/cme-customise-page";

export const metadata: Metadata = {
  title: "Customise | CME | PsychSift",
  description: "Choose what shows on your CME dashboard, and in what order.",
};

export default function CmeCustomiseRoute() {
  return <CmeCustomisePage />;
}
