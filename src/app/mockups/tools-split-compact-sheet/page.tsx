import type { Metadata } from "next";

import { ToolsSplitPaneRefinedMockup } from "@/components/tools-page-mockups/split-pane-refined-mockups";

export const metadata: Metadata = {
  title: "Tools Split Compact Sheet Mockup - Clinical KB",
  description: "Refined split-pane Tools mockup with compact mobile action sheet.",
};

export default function ToolsSplitCompactSheetMockupRoute() {
  return <ToolsSplitPaneRefinedMockup variant="compact-sheet" />;
}
