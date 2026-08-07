import type { Metadata } from "next";

import ToolsPageClient from "./tools-page-client";

export const metadata: Metadata = {
  title: "Tools - Clinical KB",
  description: "Launch Clinical KB tools, workflows, and connected clinical applications.",
};

export default function ToolsRoute() {
  return <ToolsPageClient />;
}
