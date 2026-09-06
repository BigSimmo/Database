import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Which entries belong on the printed essentials card (Task 13) — the one
 * artefact that leaves the app and gets carried around in a lanyard pocket or
 * left on a desk, rather than read on a screen that can be corrected.
 *
 * Three conditions, every one load-bearing:
 *  - `includeOnCard` is the owner's explicit opt-in. Nothing reaches the card
 *    just because it exists in a section.
 *  - `isPersonal` entries are excluded even when flagged for the card. They
 *    carry someone's direct or mobile number, which is information for the
 *    person signed in, never for a sheet of paper that can end up anywhere.
 *  - Stale entries (`onCallEntryFreshness` — unconfirmed for over a year) are
 *    excluded because a printed number that was last checked over a year ago
 *    is the worst kind: it looks just as authoritative on paper as a number
 *    checked yesterday, and the paper cannot show its own age the way the
 *    on-screen freshness badge can.
 */
export function selectCardEntries(entries: readonly OnCallEntry[], now: Date = new Date()): OnCallEntry[] {
  return entries.filter((entry) => {
    if (!entry.includeOnCard) return false;
    if (entry.isPersonal) return false;
    if (onCallEntryFreshness(entry, now).state === "stale") return false;
    return true;
  });
}
