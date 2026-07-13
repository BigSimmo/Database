import type { Metadata } from "next";

import { ApplicationsLauncherPage } from "@/components/applications-launcher-page";

export const metadata: Metadata = {
  title: "Tools - Clinical KB",
  description: "Launch Clinical KB tools, workflows, and connected clinical applications.",
};

export default function ToolsRoute() {
  return <ApplicationsLauncherPage />;
}
