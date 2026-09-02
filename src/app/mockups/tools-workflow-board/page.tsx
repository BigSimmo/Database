import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Workflow Board Mockup - PsychSift",
  description: "Workflow-grouped Tools page mockup for PsychSift.",
};

export default function ToolsWorkflowBoardMockupRoute() {
  return <ToolsPageMockupPage variant="workflow-board" />;
}
