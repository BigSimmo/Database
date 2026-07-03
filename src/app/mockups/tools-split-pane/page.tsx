import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Split Pane Mockup - Clinical KB",
  description: "Split-pane Tools directory mockup for Clinical KB.",
};

export default function ToolsSplitPaneMockupRoute() {
  return <ToolsPageMockupPage variant="split-pane" />;
}
