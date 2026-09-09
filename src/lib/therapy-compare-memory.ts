import { THERAPY_MAX_COMPARE } from "@/lib/therapy-compass-navigation";

/**
 * Device memory for the Therapy compare set.
 *
 * The URL (`?ids=`) remains the source of truth — it is what a shared link
 * carries and what `readTherapyWorkspaceState` validates. This module is a
 * strictly additive convenience: when you arrive at Therapy with no `ids` in
 * the URL, the set you last had is restored so an interrupted comparison is not
 * lost. A URL that carries `ids` always wins, so a shared link can never be
 * overwritten by whatever happens to be on the reader's device.
 *
 * Two deliberate non-goals:
 *
 * - **No cross-tab sync.** `search-pins` and `use-sidebar-pins` subscribe to
 *   the `storage` event because many components read them live. A compare set
 *   is bound to the address bar, so a remote write would rewrite *this* tab's
 *   URL underneath the reader mid-comparison. One consumer, no subscription.
 * - **No catalogue validation here.** Storage is synchronous and the 205-record
 *   catalogue is fetched, so the caller drops unknown slugs at restore time
 *   when it actually has the records. This module owns shape only.
 */

export const therapyCompareMemoryStorageKey = "clinical-kb-therapy-compare-v1";

// Browser storage can be unavailable (private mode, blocked site data) or full.
// The set is a convenience, so degrade to this tab's session rather than throw.
let inMemorySlugs: string[] | null = null;

/**
 * Shape-normalize a stored value: strings only, trimmed, no blanks, no
 * duplicates, capped at the same ceiling the URL parser applies. Mirrors the
 * rule `uniqueNonEmpty` applies in `therapy-compass-navigation.ts` so a value
 * cannot survive here that the URL would reject.
 */
export function normalizeTherapyCompareSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed || normalized.includes(trimmed)) continue;
    normalized.push(trimmed);
    if (normalized.length >= THERAPY_MAX_COMPARE) break;
  }
  return normalized;
}

export function readTherapyCompareMemory(storage?: Pick<Storage, "getItem">): string[] {
  let raw: string | null;
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) return inMemorySlugs ? [...inMemorySlugs] : [];
    raw = target.getItem(therapyCompareMemoryStorageKey);
  } catch {
    return inMemorySlugs ? [...inMemorySlugs] : [];
  }

  if (!raw) return [];
  try {
    return normalizeTherapyCompareSlugs(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Persist the set. An empty array is written, not skipped: an empty tray is a
 * real preference, and skipping it would mean "Empty" is undone by a reload.
 */
export function writeTherapyCompareMemory(slugs: readonly string[], storage?: Pick<Storage, "setItem">): string[] {
  const normalized = normalizeTherapyCompareSlugs([...slugs]);
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) {
      inMemorySlugs = [...normalized];
      return normalized;
    }
    target.setItem(therapyCompareMemoryStorageKey, JSON.stringify(normalized));
    inMemorySlugs = null;
  } catch {
    inMemorySlugs = [...normalized];
  }
  return normalized;
}

/** Test-only: drop tab session memory so cases do not leak sets into each other. */
export function resetTherapyCompareMemoryForTests() {
  inMemorySlugs = null;
}
