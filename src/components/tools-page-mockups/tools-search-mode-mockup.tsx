"use client";

import { ToolsSearchResultsPage } from "@/components/tools/tools-search-results-page";

export function ToolsSearchModeMockup() {
  return <ToolsSearchResultsPage initialQuery="Compare" canAccessFavourites={true} testId="tools-search-mode-mockup" />;
}
