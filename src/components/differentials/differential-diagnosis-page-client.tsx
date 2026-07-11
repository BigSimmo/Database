"use client";

import { DifferentialDetailPage } from "@/components/differentials/differential-detail-page";
import { useDifferentialRecord } from "@/components/clinical-dashboard/use-differential-catalog";
import type { DifferentialDetailContext } from "@/lib/differential-detail";
import type { DifferentialRecord } from "@/lib/differentials";

export function DifferentialDiagnosisPageClient({
  slug,
  fallbackRecord,
  detailContext,
}: {
  slug: string;
  fallbackRecord: DifferentialRecord;
  detailContext: DifferentialDetailContext;
}) {
  const { status, record, detailContext: liveContext, governance } = useDifferentialRecord(slug);
  const ready = status === "ready" && record !== null;
  const resolvedRecord = ready ? record : fallbackRecord;
  // Prefer the context computed for the live record (owner rows can drift from
  // the bundled snapshot); fall back to the SSR context when the API predates
  // the field or the request failed.
  const resolvedContext = ready && liveContext ? liveContext : detailContext;
  return (
    <DifferentialDetailPage
      record={resolvedRecord}
      detailContext={resolvedContext}
      liveGovernance={ready ? governance : null}
    />
  );
}
