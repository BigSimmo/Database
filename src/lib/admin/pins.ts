"use client";

import { createBrowserStore } from "@/lib/client-store-factory";
import { adminPinsChangedEvent, adminPinsStorageKey, clearAdminPins } from "@/lib/admin/pin-storage-keys";

export { adminPinsChangedEvent, adminPinsStorageKey, clearAdminPins };

/**
 * Admin's pinned numbers (owner decision, 2026-10-01): the one thing Admin keeps
 * on the device. A pin is an `on_call_entries` row id — a UUID — and nothing else,
 * so the device never holds a title, a number or any other record text. Pins are
 * cleared on sign-out and account switch (`clearAdminPins`). Every read and write
 * tolerates storage being unavailable: pins then simply do not persist.
 */
export const ADMIN_PIN_LIMIT = 8;

const ROW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY: readonly string[] = Object.freeze([]);

/** Only well-formed row ids survive a read, de-duplicated and capped. */
export function parseAdminPins(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    const ids = value.filter((id): id is string => typeof id === "string" && ROW_ID.test(id));
    return [...new Set(ids)].slice(0, ADMIN_PIN_LIMIT);
  } catch {
    return EMPTY;
  }
}

let cachedRaw: string | null = null;
let cachedPins: readonly string[] = EMPTY;

export function readAdminPins(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(adminPinsStorageKey);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPins = parseAdminPins(raw);
  }
  return cachedPins;
}

/** Adds or removes one pin. Returns false when the id is not a row id or the device refused the write. */
export function setAdminPinned(id: string, pinned: boolean): boolean {
  if (typeof window === "undefined" || !ROW_ID.test(id)) return false;
  const current = readAdminPins().filter((existing) => existing !== id);
  const next = pinned ? [...current, id].slice(-ADMIN_PIN_LIMIT) : current;
  try {
    if (next.length === 0) window.localStorage.removeItem(adminPinsStorageKey);
    else window.localStorage.setItem(adminPinsStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(adminPinsChangedEvent));
    return true;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === adminPinsStorageKey) onChange();
  };
  window.addEventListener(adminPinsChangedEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(adminPinsChangedEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The pinned row ids, oldest pin first. Empty on the server and on first paint. */
export const useAdminPins = createBrowserStore<readonly string[]>(subscribe, readAdminPins, EMPTY);
