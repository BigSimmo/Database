"use client";

import { useMemo } from "react";
import { z } from "zod";

import { createBrowserStore } from "@/lib/client-store-factory";
import { clearOnCallRecent, onCallRecentChangedEvent, onCallRecentStorageKey } from "@/lib/on-call/recent-storage-keys";

export { clearOnCallRecent, onCallRecentChangedEvent, onCallRecentStorageKey };

/**
 * The last few entries this device opened or dialled, newest first.
 *
 * On a second night a doctor re-dials the same handful of numbers, and this
 * removes the hunt for them. The owner agreed to it on three conditions, and all
 * three are structural rather than conventional:
 *
 *  1. **It never leaves the device.** There is no API route, no field on any
 *     row, and nothing in this module talks to the network.
 *  2. **It does not outlive the session.** `clearOnCallRecent` is wired into
 *     `clearAccountScopedBrowserState` (`src/lib/supabase/client.tsx`), the one
 *     sign-out/account-switch path, alongside the entry cache.
 *  3. **It stores no phone number.** A record is an entry id, a title and a
 *     time. The digits are read from the live entry when a row renders, so a
 *     personal number cannot persist on a shared phone after the account that
 *     could see it has gone — and a row for an entry the reader may no longer
 *     see simply resolves to nothing.
 *
 * Built on `createBrowserStore` following `saved-registry-storage.ts`, the
 * precedent this repository already uses, rather than a new mechanism.
 */

/** Long enough to cover a night's dialling, short enough to stay scannable. */
export const ON_CALL_RECENT_LIMIT = 8;

const recentItemSchema = z
  .object({
    /** The `on_call_entries` row this points at. */
    id: z.string().min(1),
    /** Captured at record time so a row is still nameable if the entry is gone. */
    title: z.string().min(1),
    at: z.string().min(1),
  })
  .strict();

const recentListSchema = z.array(recentItemSchema);

export type OnCallRecentItem = z.infer<typeof recentItemSchema>;

/** What a caller supplies; the timestamp is added here. */
export type OnCallRecentInput = Pick<OnCallRecentItem, "id" | "title">;

/**
 * Parse the stored list, treating anything unexpected as no history.
 *
 * Whole-list rejection rather than per-item filtering is deliberate: a partially
 * valid payload means something else wrote this key, and a half-read record is
 * worse than none — a row with no title is a number nobody can identify before
 * ringing it.
 */
function parseStoredRecent(raw: string): OnCallRecentItem[] {
  if (!raw) return [];
  try {
    const parsed = recentListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function readOnCallRecent(): OnCallRecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStoredRecent(window.localStorage.getItem(onCallRecentStorageKey) ?? "");
  } catch {
    // Private mode, blocked storage, or a throwing accessor. There is no history
    // to show, which is a correct answer rather than an error to surface.
    return [];
  }
}

/**
 * Put an entry at the front of the list.
 *
 * A repeat moves rather than duplicates: the value of this list is the second
 * night, and duplicates would push the other numbers off it within one shift.
 */
export function recordOnCallRecent(input: OnCallRecentInput, now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  const next: OnCallRecentItem[] = [
    { id: input.id, title: input.title, at: now.toISOString() },
    ...readOnCallRecent().filter((item) => item.id !== input.id),
  ].slice(0, ON_CALL_RECENT_LIMIT);
  try {
    window.localStorage.setItem(onCallRecentStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(onCallRecentChangedEvent));
  } catch {
    // Quota exceeded or blocked storage. Losing a convenience list is not worth
    // interrupting whatever the reader was actually doing.
  }
}

function getRecentSnapshot(): string {
  try {
    return window.localStorage.getItem(onCallRecentStorageKey) ?? "";
  } catch {
    return "";
  }
}

function subscribeToRecent(onChange: () => void) {
  // `storage` covers other tabs; the custom event covers this one, where the
  // native event deliberately does not fire.
  window.addEventListener("storage", onChange);
  window.addEventListener(onCallRecentChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(onCallRecentChangedEvent, onChange);
  };
}

// A raw JSON string gives `useSyncExternalStore` a stable primitive to compare
// between renders; the hook below derives the parsed value with `useMemo`. A
// snapshot that built a fresh array each call would re-render forever.
const useOnCallRecentSnapshot = createBrowserStore(subscribeToRecent, getRecentSnapshot, "");

export function useOnCallRecent(): OnCallRecentItem[] {
  const raw = useOnCallRecentSnapshot();
  return useMemo(() => parseStoredRecent(raw), [raw]);
}
