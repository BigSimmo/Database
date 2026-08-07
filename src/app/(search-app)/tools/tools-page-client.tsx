"use client";

import dynamic from "next/dynamic";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";

const ApplicationsLauncherPage = dynamic(
  () => import("@/components/applications-launcher-page").then((mod) => mod.ApplicationsLauncherPage),
  {
    ssr: false,
    loading: () => <ModeHomeRouteLoading />,
  },
);

export default function ToolsPageClient() {
  return <ApplicationsLauncherPage />;
}
