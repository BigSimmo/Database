import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recentQueryStorageKey } from "@/components/clinical-dashboard/dashboard-contracts";
import {
  clearLegacyRecentQueries,
  demoRecentQueryOwnerId,
  loadRecentQueries,
} from "@/components/clinical-dashboard/recent-query-storage";

describe("recent query storage", () => {
  let localStore: Map<string, string>;
  let sessionStore: Map<string, string>;

  beforeEach(() => {
    localStore = new Map<string, string>();
    sessionStore = new Map<string, string>();
    const storageFor = (store: Map<string, string>) => ({
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", {
      localStorage: storageFor(localStore),
      sessionStorage: storageFor(sessionStore),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads only the owner-scoped session key", () => {
    sessionStore.set(`${recentQueryStorageKey}:user-a`, JSON.stringify(["clozapine monitoring"]));
    sessionStore.set(`${recentQueryStorageKey}:user-b`, JSON.stringify(["lithium toxicity"]));
    sessionStore.set(recentQueryStorageKey, JSON.stringify(["legacy unscoped query"]));
    localStore.set(recentQueryStorageKey, JSON.stringify(["legacy unscoped query"]));

    expect(loadRecentQueries("user-a")).toEqual(["clozapine monitoring"]);
    expect(loadRecentQueries("user-b")).toEqual(["lithium toxicity"]);
    expect(loadRecentQueries(demoRecentQueryOwnerId)).toEqual([]);
  });

  it("returns nothing without an owner", () => {
    localStore.set(recentQueryStorageKey, JSON.stringify(["legacy unscoped query"]));
    expect(loadRecentQueries(null)).toEqual([]);
  });

  it("drops malformed and blank entries and caps at five", () => {
    sessionStore.set(
      `${recentQueryStorageKey}:user-a`,
      JSON.stringify(["one", "", "  ", 42, { nested: true }, "two", "three", "four", "five", "six"]),
    );
    expect(loadRecentQueries("user-a")).toEqual(["one", "two", "three", "four", "five"]);

    sessionStore.set(`${recentQueryStorageKey}:user-a`, "{not json");
    expect(loadRecentQueries("user-a")).toEqual([]);
  });

  it("purges the legacy unscoped keys without migrating them", () => {
    // 2026-07-13 audit finding 4: the legacy value's owner cannot be
    // established, so it must be deleted, never surfaced under a new owner.
    localStore.set(recentQueryStorageKey, JSON.stringify(["legacy cross-user query"]));
    sessionStore.set(recentQueryStorageKey, JSON.stringify(["legacy cross-user query"]));
    sessionStore.set(`${recentQueryStorageKey}:user-a`, JSON.stringify(["scoped query"]));

    clearLegacyRecentQueries();

    expect(localStore.has(recentQueryStorageKey)).toBe(false);
    expect(sessionStore.has(recentQueryStorageKey)).toBe(false);
    expect(loadRecentQueries("user-a")).toEqual(["scoped query"]);
  });
});
