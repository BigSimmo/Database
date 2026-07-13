import { recentQueryStorageKey } from "./dashboard-contracts";

export const demoRecentQueryOwnerId = "local-demo-session";

export function loadRecentQueries(ownerId: string | null): string[] {
  if (typeof window === "undefined" || !ownerId) return [];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(`${recentQueryStorageKey}:${ownerId}`) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 5);
  } catch {
    return [];
  }
}

// The pre-owner-scoping build persisted recent clinical queries under the
// unscoped key, which survived logout, account switching, and demo/
// authenticated transitions on shared workstations (2026-07-13 audit,
// finding 4). A surviving value's owner cannot be established, so it is
// deleted, never migrated or displayed.
export function clearLegacyRecentQueries() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(recentQueryStorageKey);
    window.sessionStorage.removeItem(recentQueryStorageKey);
  } catch {
    // Recent queries are a convenience only.
  }
}

// Sign-out / session-expiry boundary: on a shared workstation the next person
// must not inherit anyone's recent clinical question text, so remove every
// owner-scoped key too, not just the legacy unscoped residue.
export function clearRecentQueries() {
  if (typeof window === "undefined") return;
  try {
    clearLegacyRecentQueries();
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${recentQueryStorageKey}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Recent queries are a convenience only.
  }
}
