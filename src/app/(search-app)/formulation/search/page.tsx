import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormulationHomePage } from "@/components/formulation/formulation-home-page";

export const metadata: Metadata = {
  title: "Search clinical formulation | Clinical KB",
  description: "Search formulation mechanisms by pattern, clinical clue and hypothesis.",
};

type RouteProps = {
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[]; run?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted formulation searches.
 *
 * Split out of the bare `/formulation` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop.
 */
export default async function FormulationSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  // An empty query would render the mode home a second time — the very page
  // consolidation retired to /mockups/formulation-home-detailed. Send it to the
  // shared home instead, so one mode keeps exactly one home. `/calculators/search`
  // already did this; these three were the inconsistent ones.
  if (!query) redirect("/?mode=formulation");

  return <FormulationHomePage query={query} autoRunSearch={query.length > 0} />;
}
