import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cacheOnCallEntries,
  clearOnCallEntryCache,
  onCallEntryCacheChangedEvent,
  onCallEntryCacheStorageKey,
  readCachedOnCallEntries,
} from "@/lib/on-call/entry-store";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

type EventHandler = (event: Event) => void;

const contact: OnCallEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  section: "contacts",
  slug: "psych-registrar-after-hours",
  title: "Psychiatry Registrar (after hours)",
  subtitle: null,
  body: null,
  details: { role: "After-hours registrar", phone: "0400 000 000" },
  linkedDocumentIds: [],
  tags: [],
  isPersonal: true,
  includeOnCard: true,
  sortOrder: 0,
  lastVerifiedAt: "2026-08-01T00:00:00.000Z",
};

describe("on-call entry cache", () => {
  let storage: Map<string, string>;
  let listeners: Map<string, Set<EventHandler>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00.000Z"));

    storage = new Map<string, string>();
    listeners = new Map<string, Set<EventHandler>>();

    const addEventListener = vi.fn((type: string, handler: EventHandler) => {
      const existing = listeners.get(type) ?? new Set<EventHandler>();
      existing.add(handler);
      listeners.set(type, existing);
    });
    const removeEventListener = vi.fn((type: string, handler: EventHandler) => {
      listeners.get(type)?.delete(handler);
    });
    const dispatchEvent = vi.fn((event: Event) => {
      listeners.get(event.type)?.forEach((handler) => handler(event));
      return true;
    });

    vi.stubGlobal("window", {
      localStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        removeItem(key: string) {
          storage.delete(key);
        },
      },
      addEventListener,
      removeEventListener,
      dispatchEvent,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns null when nothing has ever been cached", () => {
    expect(readCachedOnCallEntries()).toBeNull();
  });

  it("writes the cache and records the save time", () => {
    const wrote = cacheOnCallEntries([contact]);

    expect(wrote).toBe(true);
    const cached = readCachedOnCallEntries();
    expect(cached?.entries).toEqual([contact]);
    // Recorded, not guessed: the save time is the moment of the write, not the
    // entry's own lastVerifiedAt.
    expect(cached?.savedAt).toBe("2026-09-04T12:00:00.000Z");
  });

  it("dispatches the change event so a reactive reader picks up the write", () => {
    const handler = vi.fn();
    window.addEventListener(onCallEntryCacheChangedEvent, handler as EventListener);

    cacheOnCallEntries([contact]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("treats corrupt stored JSON as no cache rather than throwing", () => {
    storage.set(onCallEntryCacheStorageKey, "{not-json");

    expect(readCachedOnCallEntries()).toBeNull();
  });

  it("treats a payload that no longer matches the entry schema as no cache", () => {
    storage.set(onCallEntryCacheStorageKey, JSON.stringify({ entries: [{ id: "not-an-entry" }], savedAt: "x" }));

    expect(readCachedOnCallEntries()).toBeNull();
  });

  it("empties the cache on clear and dispatches the change event", () => {
    cacheOnCallEntries([contact]);
    expect(readCachedOnCallEntries()).not.toBeNull();

    const handler = vi.fn();
    window.addEventListener(onCallEntryCacheChangedEvent, handler as EventListener);

    clearOnCallEntryCache();

    expect(readCachedOnCallEntries()).toBeNull();
    expect(storage.has(onCallEntryCacheStorageKey)).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("survives a storage accessor that throws on read, returning no cache rather than propagating", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        setItem() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        removeItem() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    expect(() => readCachedOnCallEntries()).not.toThrow();
    expect(readCachedOnCallEntries()).toBeNull();
  });

  it("survives a storage accessor that throws on write, reporting failure rather than propagating", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem() {
          return null;
        },
        setItem() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
        removeItem() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    expect(() => cacheOnCallEntries([contact])).not.toThrow();
    expect(cacheOnCallEntries([contact])).toBe(false);
    expect(() => clearOnCallEntryCache()).not.toThrow();
  });
});
