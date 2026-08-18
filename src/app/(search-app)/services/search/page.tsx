import type { Metadata } from "next";

import { Suspense } from "react";

import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";

import ServicesLoading from "../loading";

export const metadata: Metadata = {
  title: "Search clinical services | Clinical KB",
  description: "Search the private services registry by need, catchment, eligibility and referral route.",
};

type RouteProps = {
  searchParams?: Promise<{ q?: string | string[]; query?: string | string[]; run?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted services searches.
 *
 * Split out of the bare `/services` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop.
 */
export default async function ServicesSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = (firstValue(params.q) ?? firstValue(params.query) ?? "").trim();
  void query;

  return (
    <Suspense fallback={<ServicesLoading />}>
      <ServicesNavigatorPage />
    </Suspense>
  );
}
