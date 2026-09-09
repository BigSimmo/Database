import type { Metadata } from "next";

import { ToolsSearchModeMockup } from "@/components/tools-page-mockups/tools-search-mode-mockup";

export const metadata: Metadata = {
  title: "Perfected Tools Results Mode Mockup - PsychSift",
  description: "Responsive Tools results page with the universal search composer and adaptive tool details.",
};

export default function ToolsSearchModeMockupRoute() {
  return <ToolsSearchModeMockup />;
}
