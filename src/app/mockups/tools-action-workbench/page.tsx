import type { Metadata } from "next";

import { ToolsActionWorkbenchMockup } from "@/components/tools-page-mockups/rectangle-direction-mockups";

export const metadata: Metadata = {
  title: "Tools Action Workbench Mockup - PsychSift",
  description: "Rectangle-first action workbench Tools page mockup for PsychSift.",
};

export default function ToolsActionWorkbenchMockupRoute() {
  return <ToolsActionWorkbenchMockup />;
}
