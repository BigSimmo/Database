<<<<<<< HEAD
=======
import type { Database } from "@/lib/supabase/database.types";
>>>>>>> origin/main
import type { MedicationRecord } from "@/lib/medications";

export type MedicationSourceStatus = "current" | "review_due" | "outdated" | "unknown";
export type MedicationValidationStatus = "unverified" | "locally_reviewed" | "approved";

<<<<<<< HEAD
=======
export type MedicationRecordRow = Database["public"]["Tables"]["medication_records"]["Row"];
export type MedicationRecordInsert = Database["public"]["Tables"]["medication_records"]["Insert"];

>>>>>>> origin/main
const sourceStatuses: readonly MedicationSourceStatus[] = ["current", "review_due", "outdated", "unknown"];
const validationStatuses: readonly MedicationValidationStatus[] = ["unverified", "locally_reviewed", "approved"];

export function normalizeMedicationSlug(value: string) {
  return value.trim().toLowerCase();
}

export function medicationSourceStatus(value: string | null | undefined): MedicationSourceStatus {
  return sourceStatuses.find((status) => status === value) ?? "unknown";
}

export function medicationValidationStatus(value: string | null | undefined): MedicationValidationStatus {
  return validationStatuses.find((status) => status === value) ?? "unverified";
}

export function deriveGovernanceFromSections(record: MedicationRecord): {
  source_status: MedicationSourceStatus;
  validation_status: MedicationValidationStatus;
} {
  const sourceSection = record.sections.find((section) => section.type === "src");
  const sourceText =
    sourceSection?.rows
      .map((row) => row.val)
      .join(" ")
      .toLowerCase() ?? "";
  const sourceStatus: MedicationSourceStatus = sourceText.includes("checked")
    ? "current"
    : sourceText.includes("review")
      ? "review_due"
      : "unknown";
  return {
    source_status: sourceStatus,
    validation_status: "locally_reviewed",
  };
}

<<<<<<< HEAD
export function rowGovernance(row: {
  source_status: string | null;
  validation_status: string | null;
}) {
  return {
    sourceStatus: medicationSourceStatus(row.source_status),
    validationStatus: medicationValidationStatus(row.validation_status),
=======
export function recordToRow(record: MedicationRecord, ownerId: string): MedicationRecordInsert {
  const governance = deriveGovernanceFromSections(record);
  return {
    owner_id: ownerId,
    slug: normalizeMedicationSlug(record.slug),
    name: record.name,
    class: record.class,
    subclass: record.subclass,
    category: record.category,
    accent: record.accent,
    tag: record.tag,
    schedule: record.schedule,
    stats: record.stats,
    sections: record.sections,
    quick: record.quick,
    source_status: governance.source_status,
    validation_status: governance.validation_status,
  };
}

export function rowToMedicationRecord(row: MedicationRecordRow): MedicationRecord {
  return {
    slug: row.slug,
    name: row.name,
    class: row.class ?? "",
    subclass: row.subclass ?? "",
    category: row.category ?? "",
    accent: row.accent ?? "#0f766e",
    tag: row.tag ?? "",
    schedule: row.schedule ?? "",
    stats: (row.stats ?? []) as MedicationRecord["stats"],
    sections: (row.sections ?? []) as MedicationRecord["sections"],
    quick: (row.quick ?? []) as MedicationRecord["quick"],
  };
}

export function rowGovernance(row: MedicationRecordRow): {
  sourceStatus: MedicationSourceStatus;
  validationStatus: MedicationValidationStatus;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
} {
  return {
    sourceStatus: medicationSourceStatus(row.source_status),
    validationStatus: medicationValidationStatus(row.validation_status),
    lastReviewedAt: row.last_reviewed_at,
    reviewDueAt: row.review_due_at,
>>>>>>> origin/main
  };
}
