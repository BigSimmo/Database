import type { Metadata } from "next";

import { ToolsPageMockupPage } from "@/components/tools-page-mockups";

export const metadata: Metadata = {
  title: "Tools Command Center Mockup - Clinical KB",
  description: "Task-first Tools page mockup for Clinical KB.",
};

export default function ToolsCommandCenterMockupRoute() {
  return <ToolsPageMockupPage variant="command-center" />;
}
