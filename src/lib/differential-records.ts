import type { Database } from "@/lib/supabase/database.types";
import type {
  DifferentialPresentationWorkflow,
  DifferentialRecord,
  DifferentialSnapshot,
} from "@/lib/differential-snapshot";

export type DifferentialRecordKind = "presentation" | "diagnosis";
export type DifferentialSourceStatus = "current" | "review_due" | "outdated" | "unknown";
export type DifferentialValidationStatus = "unverified" | "locally_reviewed" | "approved";

export type DifferentialRecordRow = Database["public"]["Tables"]["differential_records"]["Row"];
export type DifferentialRecordInsert = Database["public"]["Tables"]["differential_records"]["Insert"];

const sourceStatuses: readonly DifferentialSourceStatus[] = ["current", "review_due", "outdated", "unknown"];
const validationStatuses: readonly DifferentialValidationStatus[] = ["unverified", "locally_reviewed", "approved"];

export function normalizeDifferentialSlug(value: string) {
  return value.trim().toLowerCase();
}

export function differentialSourceStatus(value: string | null | undefined): DifferentialSourceStatus {
  return sourceStatuses.find((status) => status === value) ?? "unknown";
}

export function differentialValidationStatus(value: string | null | undefined): DifferentialValidationStatus {
  return validationStatuses.find((status) => status === value) ?? "unverified";
}

export function deriveGovernanceFromSnapshot(snapshot: DifferentialSnapshot): {
  source_status: DifferentialSourceStatus;
  validation_status: DifferentialValidationStatus;
} {
  const reviewStatus = snapshot.governance.reviewStatus.toLowerCase();
  const sourceStatus: DifferentialSourceStatus =
    reviewStatus.includes("checked") || reviewStatus.includes("current")
      ? "current"
      : reviewStatus.includes("pending") || reviewStatus.includes("review")
        ? "review_due"
        : "unknown";
  return {
    source_status: sourceStatus,
    validation_status: "locally_reviewed",
  };
}

export function presentationToRow(
  workflow: DifferentialPresentationWorkflow,
  ownerId: string,
  snapshot: DifferentialSnapshot,
): DifferentialRecordInsert {
  const governance = deriveGovernanceFromSnapshot(snapshot);
  return {
    owner_id: ownerId,
    kind: "presentation",
    slug: normalizeDifferentialSlug(workflow.id),
    title: workflow.title,
    subtitle: workflow.subtitle,
    status: workflow.status,
    clinical_hinge: workflow.safetySnapshot.summary,
    tags: workflow.safetySnapshot.tags,
    payload: workflow,
    source: {
      label: workflow.sourceStatus.label,
      version: workflow.sourceStatus.version,
      lastUpdated: workflow.sourceStatus.lastUpdated,
    },
    source_status: governance.source_status,
    validation_status: governance.validation_status,
  };
}

export function diagnosisToRow(
  record: DifferentialRecord,
  ownerId: string,
  snapshot: DifferentialSnapshot,
): DifferentialRecordInsert {
  const governance = deriveGovernanceFromSnapshot(snapshot);
  return {
    owner_id: ownerId,
    kind: "diagnosis",
    slug: normalizeDifferentialSlug(record.slug),
    title: record.title,
    subtitle: record.subtitle,
    status: record.status,
    clinical_hinge: record.clinicalHinge,
    tags: record.safetySnapshot.tags,
    payload: record,
    source: { summary: record.safetySnapshot.summary },
    source_status: governance.source_status,
    validation_status: governance.validation_status,
  };
}

export function rowToPresentationWorkflow(row: DifferentialRecordRow): DifferentialPresentationWorkflow {
  return row.payload as DifferentialPresentationWorkflow;
}

export function rowToDifferentialRecord(row: DifferentialRecordRow): DifferentialRecord {
  return row.payload as DifferentialRecord;
}

export function rowGovernance(row: DifferentialRecordRow): {
  sourceStatus: DifferentialSourceStatus;
  validationStatus: DifferentialValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  return {
    sourceStatus: differentialSourceStatus(row.source_status),
    validationStatus: differentialValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}
