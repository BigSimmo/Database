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
 * The routine's id travels in the query and nothing reads it yet. Phase 1's
 * `CmeEntryForm` takes only an `onSubmit` prop, so the form opens blank; the id
 * is carried so the task that adds a prefill prop has the routine to resolve it
 * from, rather than having to re-plumb the two call sites. Until then a Log tap
 * opens an empty form — visible and recoverable, unlike a control that appears
 * to do nothing.
 */
export function cmeRoutineLogHref(prefill: CmeRoutineLogPrefill): string {
  return `${CME_NEW_ENTRY_ROUTE}?routine=${encodeURIComponent(prefill.routineId)}`;
}
