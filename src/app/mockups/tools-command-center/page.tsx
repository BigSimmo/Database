import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Command Center Mockup - PsychSift",
  description: "Task-first Tools page mockup for PsychSift.",
};

export default function ToolsCommandCenterMockupRoute() {
  return <ToolsPageMockupPage variant="command-center" />;
}
