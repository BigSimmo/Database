import type { Metadata } from "next";

import { ToolsSplitPaneRefinedMockup } from "@/components/tools-page-mockups/split-pane-refined-mockups";

export const metadata: Metadata = {
  title: "Tools Split Clinical Brief Mockup - Clinical KB",
  description: "Refined split-pane Tools mockup with clinical brief and mobile popup.",
};

export default function ToolsSplitClinicalBriefMockupRoute() {
  return <ToolsSplitPaneRefinedMockup variant="clinical-brief" />;
}
