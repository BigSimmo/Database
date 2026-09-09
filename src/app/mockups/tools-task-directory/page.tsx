import type { Metadata } from "next";

import { ToolsTaskDirectoryMockup } from "@/components/tools-page-mockups/task-directory-mockup";

export const metadata: Metadata = {
  title: "Tools Task Directory Mockup - PsychSift",
  description: "Task-grouped, row-dense Tools directory mockup for PsychSift.",
};

export default function ToolsTaskDirectoryMockupRoute() {
  return <ToolsTaskDirectoryMockup />;
}
