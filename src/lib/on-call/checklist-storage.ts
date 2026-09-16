"use client";

import { useMemo } from "react";
import { z } from "zod";

import { createBrowserStore } from "@/lib/client-store-factory";
import {
  clearOnCallChecklists,
  onCallChecklistChangedEvent,
  onCallChecklistStorageKey,
} from "@/lib/on-call/checklist-storage-keys";

export { clearOnCallChecklists, onCallChecklistChangedEvent, onCallChecklistStorageKey };

/**
 * Which orientation checklist items this device has ticked.
 *
 * The drawing's board 10 is two checklists — the first fifteen minutes of a
 * shift, and what to hand back before a term ends — with done items greyed and
 * struck through. A tick is a statement about a person, not about the hub, so
 * it lives here rather than on the shared row:
 *
 *  1. **It never leaves the device.** No API route, no column, no network call
 *     in this module.
 *  2. **It does not outlive the session.** `clearOnCallChecklists` is wired
 *     into `clearAccountScopedBrowserState` (`src/lib/supabase/client.tsx`),
 *     the one sign-out and account-switch path. On a shared ward computer the
 *     next registrar must start with an unticked list rather than inherit
 *     someone's progress and skip "check your keycard opens the on-call room".
 *  3. **It stores only what the page already shows.** A record is the entry's
 *     id and the step's own wording — the text printed on the shared page —
 *     and nothing else: not the step's note, and nothing the reader typed.
 *
 * Same mechanism as `recent-storage.ts`, which is the precedent this
 * repository already uses, rather than a new one.
 */

const checklistStateSchema = z.array(z.string().min(1));

/**
 * The key for one item.
 *
 * Keyed by the item's text rather than its position, so reordering a checklist
 * does not silently move somebody's ticks onto different steps — the one
 * failure mode that would make the list actively misleading. Two items with
 * identical wording in one entry share a tick, which is the right answer for
 * what is, to the reader, the same instruction twice.
 */
export function onCallChecklistItemKey(entryId: string, text: string): string {
  return `${entryId}::${text.trim().toLowerCase()}`;
}

function parseStoredChecklists(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = checklistStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function readOnCallChecklists(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStoredChecklists(window.localStorage.getItem(onCallChecklistStorageKey) ?? "");
  } catch {
    // Private mode, blocked storage, or a throwing accessor. Nothing ticked is
    // the conservative answer: an unticked step gets checked again, a wrongly
    // ticked one gets skipped.
    return [];
  }
}

/** Tick or untick one item. */
export function toggleOnCallChecklistItem(key: string, done: boolean): void {
  if (typeof window === "undefined") return;
  const current = readOnCallChecklists();
  const next = done ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key);
  try {
    window.localStorage.setItem(onCallChecklistStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(onCallChecklistChangedEvent));
  } catch {
    // Quota exceeded or blocked storage. Losing a tick is not worth
    // interrupting whatever the reader was actually doing.
  }
}

function getChecklistSnapshot(): string {
  try {
    return window.localStorage.getItem(onCallChecklistStorageKey) ?? "";
  } catch {
    return "";
  }
}

function subscribeToChecklists(onChange: () => void) {
  // `storage` covers other tabs; the custom event covers this one, where the
  // native event deliberately does not fire.
  window.addEventListener("storage", onChange);
  window.addEventListener(onCallChecklistChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(onCallChecklistChangedEvent, onChange);
  };
}

// A raw JSON string, so `useSyncExternalStore` has a stable primitive to
// compare between renders; a snapshot building a fresh array each call would
// re-render forever.
const useOnCallChecklistSnapshot = createBrowserStore(subscribeToChecklists, getChecklistSnapshot, "");

export function useOnCallChecklists(): ReadonlySet<string> {
  const raw = useOnCallChecklistSnapshot();
  return useMemo(() => new Set(parseStoredChecklists(raw)), [raw]);
}
