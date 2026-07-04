import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSavedRegistrySlugs,
  savedFormsStorageKey,
  savedRegistryStorageChangedEvent,
  savedServicesStorageKey,
  subscribeSavedRegistrySlugs,
  writeSavedRegistrySlugs,
} from "@/lib/saved-registry-storage";

type EventHandler = (event: Event) => void;

describe("saved registry storage", () => {
  let storage: Map<string, string>;
  let listeners: Map<string, Set<EventHandler>>;

  beforeEach(() => {
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
  });

  it("reads only string slugs from local storage", () => {
    storage.set(savedServicesStorageKey, JSON.stringify(["service-a", 123, null, "service-b"]));

    expect(readSavedRegistrySlugs(savedServicesStorageKey)).toEqual(["service-a", "service-b"]);
  });

  it("returns an empty list when stored payload is invalid", () => {
    storage.set(savedFormsStorageKey, "{not-json");

    expect(readSavedRegistrySlugs(savedFormsStorageKey)).toEqual([]);
  });

  it("writes slugs and dispatches the custom registry event", () => {
    const customHandler = vi.fn();
    window.addEventListener(savedRegistryStorageChangedEvent, customHandler as EventListener);

    writeSavedRegistrySlugs(savedFormsStorageKey, ["form-a", "form-b"]);

    expect(storage.get(savedFormsStorageKey)).toBe(JSON.stringify(["form-a", "form-b"]));
    expect(customHandler).toHaveBeenCalledTimes(1);
  });

  it("subscribes to storage and custom registry events", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeSavedRegistrySlugs(onChange);

    const storageHandlers = Array.from(listeners.get("storage") ?? []);
    expect(storageHandlers).toHaveLength(1);
    storageHandlers[0]?.({ type: "storage", key: savedServicesStorageKey } as unknown as Event);
    storageHandlers[0]?.({ type: "storage", key: "some-other-key" } as unknown as Event);

    writeSavedRegistrySlugs(savedServicesStorageKey, ["service-a"]);

    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    writeSavedRegistrySlugs(savedServicesStorageKey, ["service-b"]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
