import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import { resolveDifferentialCompareHandoff } from "@/lib/differentials";

export const metadata: Metadata = {
  title: "Compare differentials | Clinical KB",
  description: "Compare selected differential diagnoses side by side with safety and bedside context.",
};

type DifferentialCompareRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; ids?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Compare entry page.
 *
 * Same-presentation selections (and bare/unknown ids) redirect into a catalogue
 * presentation workflow. Cross-presentation selections render an ad-hoc compare
 * view here so every valid id is preserved. A competing `route.ts` at this path
 * is invalid in the App Router — handoff lives in the page instead.
 */
export default async function DifferentialCompareRoute({ searchParams }: DifferentialCompareRouteProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = firstSearchParam(resolvedSearchParams.query ?? resolvedSearchParams.q)?.trim() ?? "";
  const selectedIds = (firstSearchParam(resolvedSearchParams.ids) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const handoff = resolveDifferentialCompareHandoff(selectedIds, query);
  if (handoff.kind === "presentation") {
    redirect(handoff.href);
  }

  return (
    <DifferentialPresentationWorkflowPage
      query={query}
      presentationSlug={handoff.selection.workflow.id}
      selectedIds={handoff.selection.diagnosisIds}
      workflow={handoff.selection.workflow}
    />
  );
}
