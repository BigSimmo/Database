import { ADMIN_REQUIREMENTS_CATALOGUE, type AdminRequirementCatalogueItem } from "@/lib/admin/requirements";
import { isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * A presentation-only cross-reference from an entry back to the catalogue item
 * it corresponds to, for the "not for this job" section and the Personal-tab
 * split below. It is intentionally NOT the authoritative match: the authoritative
 * one lives in `src/lib/admin/requirements.ts` (`requirementChecklistRows`,
 * `requirementsRecordedCount`), which this lane reuses rather than reimplements,
 * and which already excludes a "not for this job" match from ranking and the
 * count. This helper only answers "which catalogue item does this ROW display
 * as", for grouping a not-for-this-job row under a kind chip and for deciding
 * whether an entry belongs on the Personal tab at all (no catalogue item
 * matches it, by id or by title).
 */
function normalizedTitle(value: string): string {
  return value.trim().toLowerCase();
}

function entryRequirementId(entry: OnCallEntry): unknown {
  const details = entry.details;
  return typeof details === "object" && details !== null
    ? (details as { requirementId?: unknown }).requirementId
    : undefined;
}

export function catalogueItemForEntry(
  entry: OnCallEntry,
  catalogue: readonly AdminRequirementCatalogueItem[] = ADMIN_REQUIREMENTS_CATALOGUE,
): AdminRequirementCatalogueItem | undefined {
  // Only a compliance row can be a requirement: a contacts, playbook or
  // logistics-guide row that happens to share a title is never one. This is
  // the same gate `isItemsEntry` in `src/lib/admin/requirements.ts` applies.
  if (!isComplianceEntry(entry)) return undefined;
  const requirementId = entryRequirementId(entry);
  const byId = catalogue.find((item) => item.id === requirementId);
  if (byId) return byId;
  const title = normalizedTitle(entry.title);
  return catalogue.find((item) => normalizedTitle(item.title) === title);
}

/**
 * Personal-tab membership: a compliance row that no catalogue item matches.
 * Rows from every other On Call section, and logistics guides, are never
 * renewals — listing them here would offer "Renewed" on a guide, planting
 * compliance keys that then hide it from every colleague's shared read.
 */
export function isPersonalRenewal(
  entry: OnCallEntry,
  catalogue: readonly AdminRequirementCatalogueItem[] = ADMIN_REQUIREMENTS_CATALOGUE,
): boolean {
  return isComplianceEntry(entry) && catalogueItemForEntry(entry, catalogue) === undefined;
}
