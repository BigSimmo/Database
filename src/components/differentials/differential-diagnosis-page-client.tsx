"use client";

import { DifferentialDetailPage } from "@/components/differentials/differential-detail-page";
import { useDifferentialRecord } from "@/components/clinical-dashboard/use-differential-catalog";
import type { DifferentialRecord } from "@/lib/differentials";

export function DifferentialDiagnosisPageClient({
  slug,
  fallbackRecord,
}: {
  slug: string;
  fallbackRecord: DifferentialRecord;
}) {
  const { status, record } = useDifferentialRecord(slug);
  const resolvedRecord = status === "ready" && record ? record : fallbackRecord;
  return <DifferentialDetailPage record={resolvedRecord} />;
}
