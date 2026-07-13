import type { Metadata } from "next";

import { ApplicationsLauncherPage } from "@/components/applications-launcher-page";

export const metadata: Metadata = {
  title: "Tools - Clinical KB",
  description: "Launch Clinical KB tools, workflows, and connected clinical applications.",
};

type ToolsPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ToolsRoute({ searchParams }: ToolsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.q)?.trim();

  return query ? <ApplicationsLauncherPage key={query} query={query} /> : <ApplicationsLauncherPage />;
}
