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
  const { status, record, governance } = useDifferentialRecord(slug);
  const resolvedRecord = status === "ready" && record ? record : fallbackRecord;
  return (
    <DifferentialDetailPage
      record={resolvedRecord}
      detailContext={detailContext}
      liveGovernance={status === "ready" ? governance : null}
    />
  );
}
