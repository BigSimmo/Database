import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Workflow Board Mockup - Clinical KB",
  description: "Workflow-grouped Tools page mockup for Clinical KB.",
};

export default function ToolsWorkflowBoardMockupRoute() {
  return <ToolsPageMockupPage variant="workflow-board" />;
}
