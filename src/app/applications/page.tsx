import type { Metadata } from "next";

import { ApplicationsLauncherPage } from "@/components/applications-launcher-page";

export const metadata: Metadata = {
  title: "Applications - Clinical KB",
  description: "Launch Clinical KB applications, workflows, and connected clinical tools.",
};

export default function ApplicationsRoute() {
  return <ApplicationsLauncherPage />;
}
