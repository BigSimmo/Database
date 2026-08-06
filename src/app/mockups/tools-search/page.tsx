import type { Metadata } from "next";

import { ToolsSearchRedesignMockupPage } from "@/components/tools-search-mockups/tools-search-redesign-mockup-page";

export const metadata: Metadata = {
  title: "Tools Search Mockups - Clinical KB",
  description:
    "Design scratch for /tools?q= results: Compact Results Instrument (A), Dense Launcher List (B), and Split Command Workspace (C).",
};

export default function ToolsSearchMockupRoute() {
  return <ToolsSearchRedesignMockupPage />;
}
