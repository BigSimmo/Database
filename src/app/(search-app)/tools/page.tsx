import type { Metadata } from "next";

import { ToolsSearchResultsPage } from "@/components/tools/tools-search-results-page";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

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
  const hasSubmittedSearch = firstSearchParam(params.run) === "1" && query.length > 0;

  return (
    <ToolsSearchResultsPage
      initialQuery={query}
      desktopComposerSlotId={hasSubmittedSearch ? undefined : modeHomeDesktopComposerSlotId}
    />
  );
}
