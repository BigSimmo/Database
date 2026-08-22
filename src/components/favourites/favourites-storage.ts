"use client";

export const DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY = "database:favourites:last-opened-v1";
export const DATABASE_FAVOURITES_PINNED_STORAGE_KEY = "database:favourites:pinned-v1";

const DEFAULT_PINNED_ITEM_IDS = ["acamprosate-renal-screen", "lithium-monitoring-guideline"];

// Initial baseline offsets for items before user interactions (honest absence per #339)
function getDefaultInitialTimestamps(): Record<string, number> {
  return {};
}

let inMemoryLastOpened: Record<string, number> | null = null;
let inMemoryPinned: Set<string> | null = null;
const listeners = new Set<() => void>();

export function resetFavouritesStorageForTesting(): void {
  inMemoryLastOpened = null;
  inMemoryPinned = null;
  sharedStorageListenerAttached = false;
  listeners.clear();
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

// Single shared storage handler at module level to avoid O(N²) callbacks when
// multiple subscribers are active (each per-subscriber handler would call
// notifyListeners(), firing all listeners N times per storage event).
let sharedStorageListenerAttached = false;
function ensureSharedStorageListener() {
  if (sharedStorageListenerAttached || typeof window === "undefined") return;
  sharedStorageListenerAttached = true;
  window.addEventListener("storage", (event: StorageEvent) => {
    if (
      event.key === DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY ||
      event.key === DATABASE_FAVOURITES_PINNED_STORAGE_KEY
    ) {
      inMemoryLastOpened = null;
      inMemoryPinned = null;
      notifyListeners();
    }
  });
}

export function subscribeFavouritesStorage(listener: () => void): () => void {
  ensureSharedStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const FAVOURITES_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function loadFavouriteLastOpened(): Record<string, number> {
  if (typeof window === "undefined") {
    return getDefaultInitialTimestamps();
  }
  if (inMemoryLastOpened) return inMemoryLastOpened;

  try {
    const raw = localStorage.getItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const now = Date.now();
        const pruned: Record<string, number> = {};
        for (const [key, ts] of Object.entries(parsed)) {
          if (typeof ts === "number" && Number.isFinite(ts) && now - ts < FAVOURITES_TTL_MS) {
            pruned[key] = ts;
          }
        }
        const result: Record<string, number> = { ...getDefaultInitialTimestamps(), ...pruned };
        inMemoryLastOpened = result;
        return result;
      }
    }
  } catch {
    // Fallback on JSON parse / storage errors
  }

  const fallback = getDefaultInitialTimestamps();
  inMemoryLastOpened = fallback;
  return fallback;
}

export function recordFavouriteOpened(itemId: string, timestamp: number = Date.now()): Record<string, number> {
  const current: Record<string, number> = { ...loadFavouriteLastOpened(), [itemId]: timestamp };
  inMemoryLastOpened = current;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage write errors (e.g. quota)
    }
  }
  notifyListeners();
  return current;
}

export function loadFavouritePinnedIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set(DEFAULT_PINNED_ITEM_IDS);
  }
  if (inMemoryPinned) return inMemoryPinned;

  try {
    const raw = localStorage.getItem(DATABASE_FAVOURITES_PINNED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const result = new Set(parsed.filter((id): id is string => typeof id === "string"));
        inMemoryPinned = result;
        return result;
      }
    }
  } catch {
    // Fallback on JSON parse / storage errors
  }

  const fallback = new Set(DEFAULT_PINNED_ITEM_IDS);
  inMemoryPinned = fallback;
  return fallback;
}

export function toggleFavouritePinnedId(itemId: string): Set<string> {
  const current = new Set(loadFavouritePinnedIds());
  if (current.has(itemId)) {
    current.delete(itemId);
  } else {
    current.add(itemId);
  }
  inMemoryPinned = current;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DATABASE_FAVOURITES_PINNED_STORAGE_KEY, JSON.stringify(Array.from(current)));
    } catch {
      // Ignore storage write errors
    }
  }
  notifyListeners();
  return current;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLastOpened(timestampOrLabel: number | string | undefined | null): string {
  if (
    timestampOrLabel === undefined ||
    timestampOrLabel === null ||
    timestampOrLabel === 0 ||
    timestampOrLabel === ""
  ) {
    return "Saved";
  }
  if (typeof timestampOrLabel === "string") {
    const trimmed = timestampOrLabel.trim();
    return trimmed ? timestampOrLabel : "Saved";
  }

  if (typeof timestampOrLabel === "number") {
    if (!Number.isFinite(timestampOrLabel) || timestampOrLabel <= 0) {
      return "Saved";
    }
  }

  const date = new Date(timestampOrLabel);
  if (Number.isNaN(date.getTime()) || timestampOrLabel < 0) {
    return "Saved";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - itemDate.getTime()) / (24 * 60 * 60 * 1000));

  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${mins}`;

  if (diffDays === 0) {
    return `Today ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return `${dayNames[date.getDay()]} ${timeStr}`;
  }
  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
}

export function lastOpenedScore(lastUsed: string | number | undefined | null): number {
  if (lastUsed === undefined || lastUsed === null || lastUsed === 0 || lastUsed === "") {
    return 0;
  }
  if (typeof lastUsed === "number") {
    if (!Number.isFinite(lastUsed) || lastUsed <= 0) return 0;
    return lastUsed;
  }
  if (typeof lastUsed !== "string") {
    return 0;
  }

  const lower = lastUsed.toLowerCase().trim();
  if (!lower) return 0;
  if (lower.startsWith("today")) {
    const timeMatch = lastUsed.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) return 1_000_000_000_000 + Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    return 1_000_000_000_000;
  }
  if (lower.startsWith("yesterday")) return 500_000_000_000;
  if (dayNames.some((d) => lower.startsWith(d.toLowerCase()))) return 100_000_000_000;
  return 1_000;
}
