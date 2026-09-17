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

/**
 * A mistyped year is the only way a review date lands meaningfully in the future,
 * and it must not read as a fresh check. One day of tolerance covers clock skew
 * and timezone rounding; beyond that the date is a data error. Matches
 * registry-records.ts and medication-records.ts, which bound the same way.
 */
const FUTURE_DATE_TOLERANCE_DAYS = 1;

function governanceDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function plausibleReviewDate(reviewedAt: Date, referenceDate: Date): boolean {
  const ageDays = (referenceDate.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= -FUTURE_DATE_TOLERANCE_DAYS;
}

/**
 * What counts as evidence that THIS RECORD was reviewed.
 *
 * `row.last_reviewed_at` only. `source.lastUpdated` is deliberately excluded: it
 * describes when the upstream source document changed, which says nothing about
 * whether anyone re-examined this record against it. Treating the two as
 * interchangeable is how a superseded record silently read as current — see
 * `outdatedCleared` below. registry-records.ts draws the same line.
 */
function differentialReviewEvidence(row: DifferentialRecordRow): Date | null {
  return governanceDate(row.last_reviewed_at);
}

/**
 * Whether a stored `outdated` has been cleared by a genuine re-verification.
 *
 * `outdated` asserts that guidance was superseded. That is a recorded clinical
 * judgement, and the previous test for overturning it was
 * `hasValidReviewDate || Boolean(source.lastUpdated)` — the mere EXISTENCE of
 * either. So a review date from 2019, or a `source.lastUpdated` field carrying
 * any truthy value at all, promoted a superseded record back to `current`.
 * Neither establishes that a review happened after the supersession, or that it
 * applied to the replacement content.
 *
 * Only two things clear it now: a review dated at or after the reference (a
 * re-verification recorded as of today), or a complete recorded review cycle — a
 * review date together with a review-due date, which is what a governed review
 * actually writes. An implausible future date clears nothing.
 *
 * This deliberately mirrors registry-records.ts rather than sharing code with it.
 * Each record domain carries its own read-path governance here, as
 * medication-records.ts does; the duplication is tracked separately rather than
 * resolved inside a behaviour fix.
 */
function outdatedCleared(row: DifferentialRecordRow, referenceDate: Date): boolean {
  const reviewedAt = differentialReviewEvidence(row);
  if (!reviewedAt) return false;
  if (!plausibleReviewDate(reviewedAt, referenceDate)) return false;
  if (reviewedAt.getTime() >= referenceDate.getTime()) return true;
  return governanceDate(row.review_due_at) !== null;
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

  if (storedStatus === "outdated" && outdatedCleared(row, referenceDate)) {
    const sourceText = typeof row.source === "object" && row.source !== null ? JSON.stringify(row.source) : "";
    const dueAt = governanceDate(row.review_due_at);
    if (/\b(?:not\s+checked|unchecked|unverified)\b/i.test(sourceText)) {
      sourceStatus = "unknown";
    } else if (dueAt && dueAt.getTime() < referenceDate.getTime()) {
      sourceStatus = "review_due";
    } else {
      sourceStatus = "current";
    }
  }

  return {
    sourceStatus,
    validationStatus: differentialValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}
