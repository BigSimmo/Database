import { isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { isRoleExplainerEntry } from "@/lib/on-call/who-is-who";

/**
 * Where an On Call admin (`logistics`) row lives in Admin. Stored data never
 * changes (spec): placement is read from the row's category and title each time.
 *
 * "Access" mixes building access (Help > On site) and logins (New job), so its
 * rows are split by title. "Logins" or "Systems" typed as a category go to New job.
 * Anything unrecognised goes to Guides, so no row disappears.
 */
export type AdminPlacement = "guides" | "on-site" | "new-job";

const LOGIN_TITLE = /\b(log ?ins?|passwords?|paging|pagers?|remote access|accounts?|email)\b/i;
const ON_SITE_TITLE =
  /\b(taxi|security|escort|food|parking|on-call room|call room|keycards?|after-hours entry|locked wards?)\b/i;
const WORKFORCE_ROLE = /\b(medical workforce|workforce|payroll)\b/i;

function detailString(entry: OnCallEntry, key: "category" | "role"): string {
  const details = entry.details;
  const value = typeof details === "object" && details !== null ? (details as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
}

export function adminPlacementForEntry(entry: OnCallEntry): AdminPlacement | null {
  if (entry.section !== "logistics" || isComplianceEntry(entry)) return null;
  const category = detailString(entry, "category").toLowerCase();
  if (category === "logins" || category === "systems") return "new-job";
  if (category === "access") return LOGIN_TITLE.test(entry.title) ? "new-job" : "on-site";
  if (category === "facilities" || ON_SITE_TITLE.test(entry.title)) return "on-site";
  return "guides";
}

/** Spec: "Medical-workforce who's-who entries go to Help > Contacts." */
export function isAdminWorkforceExplainer(entry: OnCallEntry): boolean {
  return isRoleExplainerEntry(entry) && WORKFORCE_ROLE.test(detailString(entry, "role"));
}

/** Workforce and payroll numbers, REUSED (not moved) as New job's contacts. */
export function isAdminJobContact(entry: OnCallEntry): boolean {
  return (
    entry.section === "contacts" && !isRoleExplainerEntry(entry) && WORKFORCE_ROLE.test(detailString(entry, "role"))
  );
}
