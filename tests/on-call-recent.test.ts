import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ON_CALL_RECENT_LIMIT,
  clearOnCallRecent,
  onCallRecentChangedEvent,
  onCallRecentStorageKey,
  readOnCallRecent,
  recordOnCallRecent,
} from "@/lib/on-call/recent-storage";

/**
 * Recent is the one thing this mode remembers about what the reader did, and it
 * is the reason it must never leave the device: it is a list of the numbers a
 * doctor rang tonight, on a phone that may be a ward phone. The rules under test
 * are therefore not conveniences — they are the conditions the owner agreed the
 * feature could exist under.
 */

const NOW = new Date("2026-09-12T22:41:00.000Z");

type EventHandler = (event: Event) => void;

let storage: Map<string, string>;
let listeners: Map<string, Set<EventHandler>>;
let failOn: { getItem?: boolean; setItem?: boolean };

/** The node-project window stub, matching `tests/on-call-entry-store.test.ts`. */
beforeEach(() => {
  storage = new Map<string, string>();
  listeners = new Map<string, Set<EventHandler>>();
  failOn = {};

  vi.stubGlobal("window", {
    localStorage: {
      getItem(key: string) {
        if (failOn.getItem) throw new Error("blocked");
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (failOn.setItem) throw new Error("quota");
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    },
    addEventListener(type: string, handler: EventHandler) {
      const existing = listeners.get(type) ?? new Set<EventHandler>();
      existing.add(handler);
      listeners.set(type, existing);
    },
    removeEventListener(type: string, handler: EventHandler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((handler) => handler(event));
      return true;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function seed(count: number) {
  for (let index = 0; index < count; index += 1) {
    recordOnCallRecent({ id: `entry-${index}`, title: `Entry ${index}` }, new Date(NOW.getTime() + index * 60_000));
  }
}

describe("readOnCallRecent", () => {
  it("is empty before anything is recorded", () => {
    expect(readOnCallRecent()).toEqual([]);
  });

  it("treats unparseable storage as no history rather than throwing", () => {
    storage.set(onCallRecentStorageKey, "{not json");
    expect(readOnCallRecent()).toEqual([]);
  });

  it("treats a payload of the wrong shape as no history", () => {
    // A schema change, or another app writing the same key. Rendering half a
    // record is worse than rendering none: a row with a number and no title is
    // a number nobody can identify before dialling it.
    storage.set(onCallRecentStorageKey, JSON.stringify([{ id: 7 }, "nope"]));
    expect(readOnCallRecent()).toEqual([]);
  });

  it("returns an empty list rather than throwing when storage itself is unavailable", () => {
    failOn.getItem = true;
    expect(readOnCallRecent()).toEqual([]);
  });
});

describe("recordOnCallRecent", () => {
  it("keeps the newest first", () => {
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    recordOnCallRecent({ id: "b", title: "Switchboard" }, new Date(NOW.getTime() + 60_000));
    expect(readOnCallRecent().map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("moves a repeat to the front instead of listing it twice", () => {
    // The whole value of this module is the second night, when the same four
    // numbers are dialled again. Duplicates would push the other three off the
    // list within one shift.
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    recordOnCallRecent({ id: "b", title: "Switchboard" }, new Date(NOW.getTime() + 60_000));
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, new Date(NOW.getTime() + 120_000));
    expect(readOnCallRecent().map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("caps the list so it cannot grow without bound on a long shift", () => {
    seed(ON_CALL_RECENT_LIMIT + 5);
    expect(readOnCallRecent()).toHaveLength(ON_CALL_RECENT_LIMIT);
  });

  it("drops the oldest when it caps, never the newest", () => {
    seed(ON_CALL_RECENT_LIMIT + 1);
    const ids = readOnCallRecent().map((item) => item.id);
    expect(ids[0]).toBe(`entry-${ON_CALL_RECENT_LIMIT}`);
    expect(ids).not.toContain("entry-0");
  });

  it("records the time so a row can say when", () => {
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    expect(readOnCallRecent()[0]?.at).toBe(NOW.toISOString());
  });

  it("notifies this tab, which the storage event does not", () => {
    const listener = vi.fn();
    window.addEventListener(onCallRecentChangedEvent, listener);
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(onCallRecentChangedEvent, listener);
  });

  it("does not throw when storage refuses the write", () => {
    failOn.setItem = true;
    expect(() => recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW)).not.toThrow();
  });
});

describe("clearOnCallRecent", () => {
  it("empties the list", () => {
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    clearOnCallRecent();
    expect(readOnCallRecent()).toEqual([]);
  });

  it("removes the key outright rather than leaving an empty list behind", () => {
    // A shared ward phone: "no history" and "an empty history object written by
    // the last user" must not be distinguishable on disk.
    recordOnCallRecent({ id: "a", title: "Ward 4B" }, NOW);
    clearOnCallRecent();
    expect(storage.has(onCallRecentStorageKey)).toBe(false);
  });

  it("notifies this tab", () => {
    const listener = vi.fn();
    window.addEventListener(onCallRecentChangedEvent, listener);
    clearOnCallRecent();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(onCallRecentChangedEvent, listener);
  });
});

describe("what is stored", () => {
  it("stores no phone number", () => {
    // The hard privacy line. A recent row shows a title and links to the entry;
    // the number is read from the live entry at render time. Persisting digits
    // would mean a personal number outliving the session on a shared device even
    // though the entry itself is withheld from a signed-out read.
    recordOnCallRecent({ id: "a", title: "Dr M. Okafor — direct" }, NOW);
    const raw = storage.get(onCallRecentStorageKey) ?? "";
    expect(raw).toContain("a");
    expect(Object.keys(readOnCallRecent()[0] ?? {}).sort()).toEqual(["at", "id", "title"]);
  });
});
