import type { Metadata } from "next";

import { ApplicationsLauncherPage } from "@/components/applications-launcher-page";

export const metadata: Metadata = {
  title: "Applications - Clinical KB",
  description: "Launch Clinical KB applications, workflows, and connected clinical tools.",
};

type ApplicationsPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApplicationsRoute({ searchParams }: ApplicationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.q)?.trim() ?? "";

  return <ApplicationsLauncherPage query={query} />;
}
