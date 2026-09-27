import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { adminPlacementForEntry } from "@/lib/admin/placement";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

const ENTRY_ANCHOR = /^#on-call-entry-([0-9a-f-]{36})$/i;

/**
 * Spec review 8. `/on-call/logistics#on-call-entry-<id>` redirects to Help with its
 * #anchor. Login rows now live on New job, so Help sends those one step further.
 * Every other anchor stays on Help.
 */
export function adminHelpForwardHref(hash: string, entries: readonly OnCallEntry[]): string | null {
  const match = ENTRY_ANCHOR.exec(hash);
  if (!match) return null;
  const entry = entries.find((candidate) => candidate.id === match[1]);
  return entry && adminPlacementForEntry(entry) === "new-job" ? `${ADMIN_PAGE_HREFS.newJob}${hash}` : null;
}
