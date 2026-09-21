import type { Metadata } from "next";

import { CmePlanPage } from "@/components/cme/cme-plan-page";

export const metadata: Metadata = {
  title: "Development plan | CME | PsychSift",
  description: "Your yearly development plan, and where it stands.",
};

export default function CmePlanRoute() {
  return <CmePlanPage />;
}
