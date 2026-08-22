import type { Metadata } from "next";

import { ToolsSearchResultsPage } from "@/components/tools/tools-search-results-page";

type ToolsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; run?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Tools - Clinical KB",
  description: "Launch Clinical KB tools, workflows, and connected clinical applications.",
};

export default async function ToolsRoute({ searchParams }: ToolsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();

  return <ToolsSearchResultsPage initialQuery={query} />;
}
