import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  onCallChecklistItemKey,
  onCallChecklistStorageKey,
  readOnCallChecklists,
  toggleOnCallChecklistItem,
} from "@/lib/on-call/checklist-storage";
import { clearOnCallChecklists } from "@/lib/on-call/checklist-storage-keys";

/**
 * `tests/**\/*.test.ts` runs in the node project, so there is no window. The
 * stub follows `tests/on-call-entry-store.test.ts`, which established the
 * shape.
 */
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  vi.stubGlobal("Event", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onCallChecklistItemKey", () => {
  it("keys by the item's words, not its position", () => {
    // Reordering a checklist must not move somebody's ticks onto different
    // steps — the one failure that would make the list actively misleading.
    expect(onCallChecklistItemKey("entry-1", "Collect the on-call phone")).toBe(
      onCallChecklistItemKey("entry-1", "  collect the ON-CALL phone  "),
    );
  });

  it("keeps two entries' identical steps apart", () => {
    expect(onCallChecklistItemKey("entry-1", "Hand back the keycard")).not.toBe(
      onCallChecklistItemKey("entry-2", "Hand back the keycard"),
    );
  });
});

describe("toggleOnCallChecklistItem", () => {
  it("ticks, unticks, and does not duplicate a repeated tick", () => {
    const key = onCallChecklistItemKey("entry-1", "Collect the on-call phone");
    toggleOnCallChecklistItem(key, true);
    toggleOnCallChecklistItem(key, true);
    expect(readOnCallChecklists()).toEqual([key]);

    toggleOnCallChecklistItem(key, false);
    expect(readOnCallChecklists()).toEqual([]);
  });

  it("leaves other items alone", () => {
    const first = onCallChecklistItemKey("entry-1", "Collect the phone");
    const second = onCallChecklistItemKey("entry-1", "Clear the locker");
    toggleOnCallChecklistItem(first, true);
    toggleOnCallChecklistItem(second, true);
    toggleOnCallChecklistItem(first, false);
    expect(readOnCallChecklists()).toEqual([second]);
  });
});

describe("readOnCallChecklists", () => {
  it("treats an unreadable payload as nothing ticked", () => {
    // The conservative answer: an unticked step gets checked again, a wrongly
    // ticked one gets skipped.
    store.set(onCallChecklistStorageKey, "{not json");
    expect(readOnCallChecklists()).toEqual([]);

    store.set(onCallChecklistStorageKey, JSON.stringify([{ key: "wrong shape" }]));
    expect(readOnCallChecklists()).toEqual([]);
  });
});

describe("clearOnCallChecklists", () => {
  it("removes the key rather than storing an empty list", () => {
    // "Nobody has used this device" and "somebody used it and signed out"
    // must leave the same trace on a shared ward computer.
    toggleOnCallChecklistItem(onCallChecklistItemKey("entry-1", "Collect the phone"), true);
    clearOnCallChecklists();
    expect(store.has(onCallChecklistStorageKey)).toBe(false);
  });
});
