import type { Metadata } from "next";

import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";

export const metadata: Metadata = {
  title: "Search diagnostic specifiers | Clinical KB",
  description: "Search diagnostic specifiers by presentation, episode pattern, course and severity.",
};

type RouteProps = {
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[]; run?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted specifier searches.
 *
 * Split out of the bare `/specifiers` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop.
 */
export default async function SpecifiersSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  return <SpecifiersHomePage query={query} autoRunSearch={query.length > 0} />;
}
