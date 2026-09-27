import {
  ADMIN_REQUIREMENTS_CATALOGUE,
  catalogueItemForEntry,
  type AdminRequirementCatalogueItem,
} from "@/lib/admin/requirements";
import { isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Renewals' view of the catalogue match. `catalogueItemForEntry` is the one
 * matcher in `src/lib/admin/requirements.ts` (re-exported here so the
 * Renewals components keep one import); this file adds only the Personal-tab
 * rule on top of it.
 */
export { catalogueItemForEntry };

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
