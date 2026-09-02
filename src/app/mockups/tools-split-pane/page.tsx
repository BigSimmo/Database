import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Split Pane Mockup - PsychSift",
  description: "Split-pane Tools directory mockup for PsychSift.",
};

export default function ToolsSplitPaneMockupRoute() {
  return <ToolsPageMockupPage variant="split-pane" />;
}
