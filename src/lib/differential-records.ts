import type { Database } from "@/lib/supabase/database.types";
import { normalizePresentationWorkflow } from "@/lib/differential-presentation-display";
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
  if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(reviewStatus)) {
    return {
      source_status: "unknown",
      validation_status: "unverified",
    };
  }
  const sourceStatus: DifferentialSourceStatus =
    reviewStatus.includes("checked") || reviewStatus.includes("current")
      ? "current"
      : reviewStatus.includes("pending") || reviewStatus.includes("review")
        ? "review_due"
        : "unknown";
  return {
    source_status: sourceStatus,
    validation_status: "unverified",
  };
}

export function presentationToRow(
  workflow: DifferentialPresentationWorkflow,
  ownerId: string,
  snapshot: DifferentialSnapshot,
): DifferentialRecordInsert {
  const normalizedWorkflow = normalizePresentationWorkflow(workflow);
  const governance = deriveGovernanceFromSnapshot(snapshot);
  return {
    owner_id: ownerId,
    kind: "presentation",
    slug: normalizeDifferentialSlug(normalizedWorkflow.id),
    title: normalizedWorkflow.title,
    subtitle: normalizedWorkflow.subtitle,
    status: normalizedWorkflow.status,
    clinical_hinge: normalizedWorkflow.safetySnapshot.summary,
    tags: normalizedWorkflow.safetySnapshot.tags,
    payload: normalizedWorkflow,
    source: {
      label: normalizedWorkflow.sourceStatus.label,
      version: normalizedWorkflow.sourceStatus.version,
      lastUpdated: normalizedWorkflow.sourceStatus.lastUpdated,
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
  return normalizePresentationWorkflow(row.payload as DifferentialPresentationWorkflow);
}

export function rowToDifferentialRecord(row: DifferentialRecordRow): DifferentialRecord {
  return row.payload as DifferentialRecord;
}

export function rowGovernance(
  row: DifferentialRecordRow,
  referenceDate: Date = new Date(),
): {
  sourceStatus: DifferentialSourceStatus;
  validationStatus: DifferentialValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  const storedStatus = differentialSourceStatus(row.source_status);
  let sourceStatus = storedStatus;

  if (storedStatus === "outdated") {
    // `outdated` asserts that guidance was superseded. That is a recorded
    // clinical judgement, so a stored `outdated` is preserved against normal age
    // degradation. However, if the record was subsequently updated or re-verified
    // (e.g. `row.last_reviewed_at` is newer than reference or an explicit
    // re-verification timestamp is present), `sourceStatus` is re-evaluated rather
    // than being permanently stuck in "outdated" forever.
    const reviewedAt = row.last_reviewed_at ? new Date(row.last_reviewed_at) : null;
    const hasValidReviewDate = reviewedAt !== null && !Number.isNaN(reviewedAt.getTime());
    const isNewerThanReference = hasValidReviewDate && reviewedAt.getTime() >= referenceDate.getTime();
    const sourceObj = row.source && typeof row.source === "object" ? (row.source as Record<string, unknown>) : null;
    const hasExplicitReverification = hasValidReviewDate || Boolean(sourceObj?.lastUpdated);

    if (hasExplicitReverification || isNewerThanReference) {
      const sourceText = typeof row.source === "object" && row.source !== null ? JSON.stringify(row.source) : "";
      if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(sourceText)) {
        sourceStatus = "unknown";
      } else if (
        row.review_due_at &&
        !Number.isNaN(new Date(row.review_due_at).getTime()) &&
        new Date(row.review_due_at).getTime() < referenceDate.getTime()
      ) {
        sourceStatus = "review_due";
      } else {
        sourceStatus = "current";
      }
    }
  }

  return {
    sourceStatus,
    validationStatus: differentialValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}
