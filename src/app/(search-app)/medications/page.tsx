import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appModeHomeHref } from "@/lib/app-modes";

import { MedicationsHomeClient } from "./medications-home-client";

export const metadata: Metadata = {
  title: "Medication - Clinical KB",
  description: "Medication dosing, safety, and monitoring guidance from indexed sources.",
};

type MedicationsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; run?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The Medication mode home.
 *
 * Replaces the former blanket 307 alias to `/?mode=prescribing`: `/` is now the
 * single shared home for every mode, so prescribing needs its own home like every
 * other mode. `/medications` is always-standalone and owns its body via
 * `MedicationsHomeClient` (not ClinicalDashboard).
 *
 * Submitted deep links (`q` + `run=1`) still resolve to the dashboard-owned
 * prescribing results surface at `/?mode=prescribing&q=…&run=1`, preserving old
 * bookmarks from when this path was a full redirect.
 */
export default async function MedicationsHomeRoute({ searchParams }: MedicationsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();
  const hasSubmittedSearch = firstSearchParam(params.run) === "1" && query.length > 0;

  if (hasSubmittedSearch) {
    redirect(appModeHomeHref("prescribing", { query, run: true }));
  }

  return <MedicationsHomeClient />;
}
