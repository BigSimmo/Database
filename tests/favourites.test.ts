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
  toggleFavouritePinnedId,
} from "@/components/favourites/favourites-storage";

describe("favourites storage, timestamps and pinning", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads default seed timestamps and records real timestamp when item is opened", () => {
    const initial = loadFavouriteLastOpened();
    expect(initial["acamprosate-renal-screen"]).toBeDefined();
    expect(typeof initial["acamprosate-renal-screen"]).toBe("number");

    const customTime = Date.now() + 5000;
    recordFavouriteOpened("test-item-1", customTime);

    const updated = loadFavouriteLastOpened();
    expect(updated["test-item-1"]).toBe(customTime);

    const storedRaw = localStorage.getItem(DATABASE_FAVOURITES_LAST_OPENED_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed["test-item-1"]).toBe(customTime);
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

  it("formats timestamps into human-readable relative strings", () => {
    const now = Date.now();
    const formattedNow = formatLastOpened(now);
    expect(formattedNow).toMatch(/^Today \d{2}:\d{2}$/);

    const yesterday = now - 24 * 60 * 60 * 1000;
    const formattedYesterday = formatLastOpened(yesterday);
    expect(formattedYesterday).toMatch(/^Yesterday \d{2}:\d{2}$/);

    expect(formatLastOpened(undefined)).toBe("Saved");
    expect(formatLastOpened("Today 08:44")).toBe("Today 08:44");
  });

  it("computes sort scores correctly prioritizing recent timestamps", () => {
    const t1 = Date.now();
    const t2 = t1 - 10000;

    expect(lastOpenedScore(t1)).toBeGreaterThan(lastOpenedScore(t2));
    expect(lastOpenedScore("Today 10:00")).toBeGreaterThan(lastOpenedScore("Yesterday 10:00"));
    expect(lastOpenedScore("Yesterday 10:00")).toBeGreaterThan(lastOpenedScore("Mon 10:00"));
    expect(lastOpenedScore("Saved")).toBe(1000);
  });
});
