"use client";

import { useEffect, useMemo } from "react";
import { z } from "zod";

import { createBrowserStore } from "@/lib/client-store-factory";
import {
  onCallDeviceStateChangedEvent,
  onCallDeviceStoreChangedEvent,
  onCallUsualOrderStorageKey,
} from "@/lib/on-call/device-state-keys";
import { onCallPeriod } from "@/lib/on-call/number-resolver";
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
/** Pins are for the handful rung every shift; a fifth is refused. */
export const ON_CALL_USUAL_PIN_LIMIT = 4;

/** Where the row came from: the reader's own entries or the hospital handbook. */
export type OnCallRecentSource = "entry" | "handbook";

/**
 * `source`, `count` and `pinned` were added for "Your usual" (kit 1.4). They
 * default, so a list stored on a device before they existed still parses. None
 * of them is a phone number: rule 3 above still holds.
 */
const recentItemSchema = z
  .object({
    /** The `on_call_entries` row (or handbook entry) this points at. */
    id: z.string().min(1),
    /** Captured at record time so a row is still nameable if the entry is gone. */
    title: z.string().min(1),
    at: z.string().min(1),
    source: z.enum(["entry", "handbook"]).default("entry"),
    /** Taps on this device; the list keeps the most-rung numbers. */
    count: z.number().int().positive().default(1),
    pinned: z.boolean().default(false),
  })
  .strict();

const recentListSchema = z.array(recentItemSchema);

export type OnCallRecentItem = {
  id: string;
  title: string;
  at: string;
  source: OnCallRecentSource;
  count: number;
  pinned: boolean;
};

/** What a caller supplies; the timestamp and count are added here. */
export type OnCallRecentInput = { id: string; title: string; source?: OnCallRecentSource };

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

function writeRecent(next: readonly OnCallRecentItem[]): void {
  try {
    window.localStorage.setItem(onCallRecentStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(onCallRecentChangedEvent));
  } catch {
    // Quota exceeded or blocked storage. Losing a convenience list is not worth
    // interrupting whatever the reader was actually doing.
  }
}

/**
 * Keep the list to `ON_CALL_RECENT_LIMIT`, dropping the oldest UNPINNED rows:
 * a pin survives the cap, because the reader chose it.
 */
function capRecent(items: readonly OnCallRecentItem[]): OnCallRecentItem[] {
  const overflow = items.length - ON_CALL_RECENT_LIMIT;
  if (overflow <= 0) return [...items];
  const kept = [...items];
  let dropped = 0;
  for (let index = kept.length - 1; index >= 0 && dropped < overflow; index -= 1) {
    if (!kept[index].pinned) {
      kept.splice(index, 1);
      dropped += 1;
    }
  }
  return kept;
}

/**
 * Put an entry at the front of the list, counting the tap.
 *
 * A repeat moves rather than duplicates: the value of this list is the second
 * night, and duplicates would push the other numbers off it within one shift.
 * The count and pin carry over, so "Your usual" knows the most-rung numbers.
 */
export function recordOnCallRecent(input: OnCallRecentInput, now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  const existing = readOnCallRecent();
  const previous = existing.find((item) => item.id === input.id);
  const next = capRecent([
    {
      id: input.id,
      title: input.title,
      at: now.toISOString(),
      source: input.source ?? previous?.source ?? "entry",
      count: (previous?.count ?? 0) + 1,
      pinned: previous?.pinned ?? false,
    },
    ...existing.filter((item) => item.id !== input.id),
  ]);
  writeRecent(next);
}

/** Pin or unpin a row. A fifth pin is refused silently: the control shows the limit. */
export function setOnCallUsualPinned(id: string, pinned: boolean): void {
  if (typeof window === "undefined") return;
  const existing = readOnCallRecent();
  const target = existing.find((item) => item.id === id);
  if (!target || target.pinned === pinned) return;
  if (pinned && existing.filter((item) => item.pinned).length >= ON_CALL_USUAL_PIN_LIMIT) return;
  writeRecent(existing.map((item) => (item.id === id ? { ...item, pinned } : item)));
}

/**
 * The full "Your usual" sort, used at the start of a shift: pinned rows (newest
 * pin activity first), then the most-tapped, then the most recent. Ties keep
 * the stored order, so the sort is total and stable.
 */
export function onCallUsualOrder(items: readonly OnCallRecentItem[]): OnCallRecentItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        Number(b.item.pinned) - Number(a.item.pinned) ||
        (a.item.pinned && b.item.pinned ? b.item.at.localeCompare(a.item.at) : 0) ||
        b.item.count - a.item.count ||
        b.item.at.localeCompare(a.item.at) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

/**
 * Which shift "now" belongs to, as a stable key: the hour the current in-hours
 * or after-hours period began (`onCallPeriod`, WA holidays included). Lane A may
 * pass its own roster-derived key instead.
 */
export function onCallUsualShiftKey(now: Date = new Date()): string {
  const current = onCallPeriod(now);
  const probe = new Date(now.getTime());
  probe.setMinutes(0, 0, 0);
  for (let step = 0; step < 24 * 8; step += 1) {
    const earlier = new Date(probe.getTime());
    earlier.setHours(earlier.getHours() - 1);
    if (onCallPeriod(earlier) !== current) break;
    probe.setTime(earlier.getTime());
  }
  return probe.toISOString();
}

const frozenOrderSchema = z.object({ shiftKey: z.string().min(1), ids: z.array(z.string().min(1)) }).strict();
type FrozenOrder = z.infer<typeof frozenOrderSchema>;

function parseFrozenOrder(raw: string): FrozenOrder | null {
  if (!raw) return null;
  try {
    const parsed = frozenOrderSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Arrange "Your usual" without moving anything under the thumb (review F8).
 *
 * Within one shift the order is frozen: rows keep their places, a newly
 * frequent number joins at the END, and pins stay on top. The full sort runs
 * only when the shift key changes. Pure, so the hook and the reader agree.
 */
export function arrangeOnCallUsual(
  items: readonly OnCallRecentItem[],
  frozen: FrozenOrder | null,
  shiftKey: string,
): { items: OnCallRecentItem[]; frozen: FrozenOrder } {
  if (!frozen || frozen.shiftKey !== shiftKey) {
    const sorted = onCallUsualOrder(items);
    return { items: sorted, frozen: { shiftKey, ids: sorted.map((item) => item.id) } };
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const kept = frozen.ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const keptIds = new Set(kept.map((item) => item.id));
  const joined = onCallUsualOrder(items.filter((item) => !keptIds.has(item.id)));
  const inShiftOrder = [...kept, ...joined];
  const arranged = [...inShiftOrder.filter((item) => item.pinned), ...inShiftOrder.filter((item) => !item.pinned)];
  return { items: arranged, frozen: { shiftKey, ids: arranged.map((item) => item.id) } };
}

function readFrozenOrder(): FrozenOrder | null {
  try {
    return parseFrozenOrder(window.localStorage.getItem(onCallUsualOrderStorageKey) ?? "");
  } catch {
    return null;
  }
}

function writeFrozenOrder(frozen: FrozenOrder): void {
  const current = readFrozenOrder();
  if (current && current.shiftKey === frozen.shiftKey && current.ids.join("\n") === frozen.ids.join("\n")) return;
  try {
    window.localStorage.setItem(onCallUsualOrderStorageKey, JSON.stringify(frozen));
  } catch {
    // Blocked storage: the list still renders, sorted afresh each time.
  }
}

/** "Your usual" for this shift, recording the frozen order (ids only) as it goes. */
export function readOnCallUsual(
  now: Date = new Date(),
  shiftKey: string = onCallUsualShiftKey(now),
): OnCallRecentItem[] {
  if (typeof window === "undefined") return [];
  const arranged = arrangeOnCallUsual(readOnCallRecent(), readFrozenOrder(), shiftKey);
  writeFrozenOrder(arranged.frozen);
  return arranged.items;
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

function getFrozenSnapshot(): string {
  try {
    return window.localStorage.getItem(onCallUsualOrderStorageKey) ?? "";
  } catch {
    return "";
  }
}

function subscribeToFrozen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(onCallDeviceStateChangedEvent, onChange);
  window.addEventListener(onCallDeviceStoreChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(onCallDeviceStateChangedEvent, onChange);
    window.removeEventListener(onCallDeviceStoreChangedEvent, onChange);
  };
}

const useFrozenOrderSnapshot = createBrowserStore(subscribeToFrozen, getFrozenSnapshot, "");

/**
 * "Your usual", in this shift's frozen order. The order is derived in render
 * and recorded after it, so a render never writes storage.
 */
export function useOnCallUsual(shiftKey?: string): OnCallRecentItem[] {
  const items = useOnCallRecent();
  const frozenRaw = useFrozenOrderSnapshot();
  const key = shiftKey ?? onCallUsualShiftKey();
  const arranged = useMemo(() => arrangeOnCallUsual(items, parseFrozenOrder(frozenRaw), key), [items, frozenRaw, key]);
  useEffect(() => {
    writeFrozenOrder(arranged.frozen);
  }, [arranged.frozen]);
  return arranged.items;
}
