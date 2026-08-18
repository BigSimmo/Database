/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";

import {
  DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY,
  DATABASE_FAVOURITES_PINNED_STORAGE_KEY,
  formatLastOpened,
  lastOpenedScore,
  loadFavouriteLastOpened,
  loadFavouritePinnedIds,
  recordFavouriteOpened,
  resetFavouritesStorageForTesting,
  subscribeFavouritesStorage,
  toggleFavouritePinnedId,
} from "@/components/favourites/favourites-storage";

describe("favourites storage, timestamps and pinning", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFavouritesStorageForTesting();
  });

  it("enforces honest absence initially and records real timestamp when item is opened", () => {
    const initial = loadFavouriteLastOpened();
    expect(initial["acamprosate-renal-screen"]).toBeUndefined();
    expect(initial["lithium-monitoring-guideline"]).toBeUndefined();
    expect(Object.keys(initial)).toHaveLength(0);

    const beforeOpen = Date.now();
    const recorded = recordFavouriteOpened("acamprosate-renal-screen");
    const afterOpen = Date.now();

    expect(recorded["acamprosate-renal-screen"]).toBeDefined();
    expect(recorded["acamprosate-renal-screen"]).toBeGreaterThanOrEqual(beforeOpen);
    expect(recorded["acamprosate-renal-screen"]).toBeLessThanOrEqual(afterOpen);

    const updated = loadFavouriteLastOpened();
    expect(updated["acamprosate-renal-screen"]).toBe(recorded["acamprosate-renal-screen"]);
    expect(updated["unopened-item"]).toBeUndefined();

    const storedRaw = localStorage.getItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed["acamprosate-renal-screen"]).toBe(recorded["acamprosate-renal-screen"]);
  });

  it("allows recording custom timestamps when explicitly provided", () => {
    const customTime = Date.now() + 5000;
    recordFavouriteOpened("test-item-1", customTime);

    const updated = loadFavouriteLastOpened();
    expect(updated["test-item-1"]).toBe(customTime);

    const storedRaw = localStorage.getItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed["test-item-1"]).toBe(customTime);
  });

  it("safely ignores array payloads in last-opened storage and falls back to honest absence", () => {
    localStorage.setItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY, JSON.stringify(["invalid", "array"]));
    const loaded = loadFavouriteLastOpened();
    expect(loaded).toEqual({});
  });

  it("resets in-memory cache and listeners when resetFavouritesStorageForTesting is invoked", () => {
    let listenerCalled = false;
    const unsubscribe = subscribeFavouritesStorage(() => {
      listenerCalled = true;
    });

    recordFavouriteOpened("item-before-reset", 12345);
    expect(loadFavouriteLastOpened()["item-before-reset"]).toBe(12345);
    expect(listenerCalled).toBe(true);

    listenerCalled = false;
    resetFavouritesStorageForTesting();

    // After reset, inMemoryLastOpened is cleared; if localStorage is also cleared, it returns honest absence ({})
    localStorage.clear();
    expect(loadFavouriteLastOpened()).toEqual({});

    // Also verify listeners were cleared by resetFavouritesStorageForTesting
    recordFavouriteOpened("item-after-reset", 67890);
    expect(listenerCalled).toBe(false);

    unsubscribe();
  });

  it("loads default pinned IDs and allows toggling pinning state with localStorage persistence", () => {
    const initialPinned = loadFavouritePinnedIds();
    expect(initialPinned.has("acamprosate-renal-screen")).toBe(true);
    expect(initialPinned.has("custom-unpinned-id")).toBe(false);

    toggleFavouritePinnedId("custom-unpinned-id");
    const updated = loadFavouritePinnedIds();
    expect(updated.has("custom-unpinned-id")).toBe(true);

    const storedRaw = localStorage.getItem(DATABASE_FAVOURITES_PINNED_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed).toContain("custom-unpinned-id");

    toggleFavouritePinnedId("custom-unpinned-id");
    const reverted = loadFavouritePinnedIds();
    expect(reverted.has("custom-unpinned-id")).toBe(false);
  });

  it("formats timestamps into human-readable relative strings and handles empty / invalid timestamps with honest absence", () => {
    const now = Date.now();
    const formattedNow = formatLastOpened(now);
    expect(formattedNow).toMatch(/^Today \d{2}:\d{2}$/);

    const yesterday = now - 24 * 60 * 60 * 1000;
    const formattedYesterday = formatLastOpened(yesterday);
    expect(formattedYesterday).toMatch(/^Yesterday \d{2}:\d{2}$/);

    expect(formatLastOpened(undefined)).toBe("Saved");
    expect(formatLastOpened(null as unknown as undefined)).toBe("Saved");
    expect(formatLastOpened(0)).toBe("Saved");
    expect(formatLastOpened(NaN)).toBe("Saved");
    expect(formatLastOpened(-100)).toBe("Saved");
    expect(formatLastOpened("Today 08:44")).toBe("Today 08:44");
  });

  it("computes sort scores correctly prioritizing recent timestamps and handles undefined / 0 / invalid values without NaN", () => {
    const t1 = Date.now();
    const t2 = t1 - 10000;

    expect(lastOpenedScore(t1)).toBeGreaterThan(lastOpenedScore(t2));
    expect(lastOpenedScore("Today 10:00")).toBeGreaterThan(lastOpenedScore("Yesterday 10:00"));
    expect(lastOpenedScore("Yesterday 10:00")).toBeGreaterThan(lastOpenedScore("Mon 10:00"));
    expect(lastOpenedScore("Saved")).toBe(1000);

    // Edge cases and honest absence checks
    expect(lastOpenedScore(undefined)).toBe(0);
    expect(lastOpenedScore(0)).toBe(0);
    expect(lastOpenedScore(NaN)).toBe(0);
    expect(lastOpenedScore(-100)).toBe(0);
    expect(lastOpenedScore(Infinity)).toBe(0);
    expect(lastOpenedScore("")).toBe(0);
    expect(Number.isNaN(lastOpenedScore(undefined))).toBe(false);
    expect(Number.isNaN(lastOpenedScore(0))).toBe(false);
    expect(Number.isNaN(lastOpenedScore(NaN))).toBe(false);

    expect(lastOpenedScore("Saved")).toBeGreaterThan(lastOpenedScore(undefined));

    // SEC-M1: Corrupted or non-string/non-number inputs must safely return 0 without throwing TypeError
    expect(lastOpenedScore({} as unknown as string)).toBe(0);
    expect(lastOpenedScore(true as unknown as string)).toBe(0);
    expect(lastOpenedScore(["invalid"] as unknown as string)).toBe(0);
  });
});
