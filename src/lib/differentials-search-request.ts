import { appModeQueryMode } from "@/lib/app-modes";
import { readSearchNavigationContext } from "@/lib/search-navigation-context";

export function differentialsSearchRequestBody(params: Pick<URLSearchParams, "get" | "getAll">, query: string) {
  const { queryMode, scopeFilters } = readSearchNavigationContext(params);
  return {
    query,
    mode: "differentials" as const,
    queryMode: appModeQueryMode("differentials", queryMode),
    filters: scopeFilters,
    documentLimit: 30,
    topK: 20,
  };
}
