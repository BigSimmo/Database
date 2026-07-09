import type { MedicationRecord } from "@/lib/medications";

export type MedicationSourceStatus = "current" | "review_due" | "outdated" | "unknown";
export type MedicationValidationStatus = "unverified" | "locally_reviewed" | "approved";

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

export function rowGovernance(row: {
  source_status: string | null;
  validation_status: string | null;
}) {
  return {
    sourceStatus: medicationSourceStatus(row.source_status),
    validationStatus: medicationValidationStatus(row.validation_status),
  };
}
