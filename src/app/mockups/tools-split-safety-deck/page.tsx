import type { Metadata } from "next";

import { ToolsSplitPaneRefinedMockup } from "@/components/tools-page-mockups/split-pane-refined-mockups";

export const metadata: Metadata = {
  title: "Tools Split Safety Deck Mockup - Clinical KB",
  description: "Refined split-pane Tools mockup with safety-focused clinical organisation.",
};

export default function ToolsSplitSafetyDeckMockupRoute() {
  return <ToolsSplitPaneRefinedMockup variant="safety-deck" />;
}
