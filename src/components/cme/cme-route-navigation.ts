import type { CmeRoutineLogPrefill } from "@/lib/cme/routines";

/** The entry form. One screen, reached from the log, the setup page and a routine's Log control. */
export const CME_NEW_ENTRY_ROUTE = "/cme/new";

/**
 * Where a routine's "Log" control sends the owner.
 *
 * A routine only ever OFFERS — `CmeRoutinesPage` makes that guarantee
 * structurally, and this href keeps it: it navigates to the entry form, where
 * the owner still has to press Save. Nothing on this path writes an entry.
 *
 * The routine id travels in the query. The server resolves only an owner-loaded
 * routine and passes its title, usual hours and category split to the form; the
 * owner still reviews every field and presses Save before an entry exists.
 */
export function cmeRoutineLogHref(prefill: CmeRoutineLogPrefill): string {
  return `${CME_NEW_ENTRY_ROUTE}?routine=${encodeURIComponent(prefill.routineId)}`;
}
