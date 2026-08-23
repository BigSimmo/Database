import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appModeSelectionHref } from "@/lib/app-modes";
import { unsubmittedModeSearchTargetForSearchParams } from "@/lib/consolidated-mode-home-redirect";
import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

export const metadata: Metadata = {
  title: "Search differential diagnoses | Clinical KB",
  description: "Compare differential causes and clinical clues against the indexed library.",
};

type RouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Submitted differential searches.
 *
 * Split out of the bare `/differentials` path when that became a redirect onto the shared
 * home: results need a route of their own, or `appModeHomeHref` would send a
 * submitted query back through the redirect and loop. An empty query has no
 * browse view of its own — diagnoses and presentations are separate tabs — so
 * it forwards to the shared home the same way `/calculators/search` does.
 * The proxy issues the 307; this page-level redirect is the backstop and uses
 * the same target builder so navigation context is not dropped.
 */
export default async function DifferentialsSearchRoute(props: RouteProps) {
  const params = props.searchParams ? await props.searchParams : {};
  const query = firstValue(params.q)?.trim() || firstValue(params.query)?.trim() || "";
  if (!query) {
    redirect(
      unsubmittedModeSearchTargetForSearchParams("/differentials/search", params) ??
        appModeSelectionHref("differentials"),
    );
  }

  return <DifferentialsHomePage query={query} autoRunSearch />;
}
