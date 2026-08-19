import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

export const metadata: Metadata = {
  title: "Search differential diagnoses | Clinical KB",
  description: "Compare differential causes and clinical clues against the indexed library.",
};

type RouteProps = {
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[]; run?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted differential searches.
 *
 * Split out of the bare `/differentials` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop.
 */
export default async function DifferentialsSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  // An empty query would render the mode home a second time — the very page
  // consolidation retired to /mockups/differentials-home-detailed. Send it to the
  // shared home instead, so one mode keeps exactly one home. `/calculators/search`
  // already did this; these three were the inconsistent ones.
  if (!query) redirect("/?mode=differentials");

  return <DifferentialsHomePage query={query} autoRunSearch={query.length > 0} />;
}
