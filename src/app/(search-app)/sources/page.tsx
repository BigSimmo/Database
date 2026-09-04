import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { standaloneModeSubmittedSearchTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";

import { SourcesHomeClient } from "./sources-home-client";

export const metadata: Metadata = {
  title: "Sources",
  description: "Ranked clinical source catalogue and traceability.",
};

type SourcesHomeRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The Sources mode home.
 *
 * `/sources` used to serve both the home and the catalogue. The catalogue now has
 * its own route, so a submitted deep link (`q` + `run=1`) forwards there and every
 * bookmark from before the split keeps resolving. `src/proxy.ts` normally serves
 * that as a 307 through the same resolver; this is the backstop for anything the
 * matcher misses.
 */
export default async function SourcesHomeRoute({ searchParams }: SourcesHomeRouteProps) {
  const params = searchParams ? await searchParams : {};
  const submittedTarget = standaloneModeSubmittedSearchTargetForSearchParams("/sources", params);
  if (submittedTarget) redirect(submittedTarget);

  return <SourcesHomeClient />;
}
