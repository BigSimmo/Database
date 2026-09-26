import type { OnCallEntriesState } from "@/lib/on-call/entry-store";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The reader's own rows, which Admin lets them edit and export. The shared On Call
 * read also returns other accounts' non-personal rows (`isOwn: false`), which
 * `selectAdminSharedEntries` returns read-only. Demo mode serves one synthetic
 * corpus with no owner, so it is shown whole as the reader's.
 */
export function selectAdminOwnEntries(state: Pick<OnCallEntriesState, "entries" | "demoMode">): OnCallEntry[] {
  return state.demoMode ? state.entries : state.entries.filter((entry) => entry.isOwn === true);
}

/**
 * Other doctors' shared (non-personal) rows, shown read-only so a shared guide does
 * not vanish when On Call's Admin page goes (spec review 1). Never exported in a pack.
 */
export function selectAdminSharedEntries(state: Pick<OnCallEntriesState, "entries" | "demoMode">): OnCallEntry[] {
  return state.demoMode ? [] : state.entries.filter((entry) => entry.isOwn === false && !entry.isPersonal);
}

export type AdminLoadState = "loading" | "failed" | "signed-out" | "ready";

/**
 * Admin is online only (spec). A failed fetch serves the device cache, which
 * holds no personal and no compliance rows (`cacheOnCallEntries`), so reading it
 * as complete would print "nothing due" over a registration about to lapse.
 */
export function adminLoadState(
  state: Pick<OnCallEntriesState, "loading" | "isOffline" | "loadError" | "signedOut">,
): AdminLoadState {
  if (state.isOffline || state.loadError) return "failed";
  if (state.loading) return "loading";
  if (state.signedOut) return "signed-out";
  return "ready";
}
