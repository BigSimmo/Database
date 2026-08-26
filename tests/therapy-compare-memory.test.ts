import { afterEach, describe, expect, it } from "vitest";

import { THERAPY_MAX_COMPARE } from "@/lib/therapy-compass-navigation";
import {
  normalizeTherapyCompareSlugs,
  readTherapyCompareMemory,
  resetTherapyCompareMemoryForTests,
  therapyCompareMemoryStorageKey,
  writeTherapyCompareMemory,
} from "@/lib/therapy-compare-memory";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function throwingStorage() {
  return {
    getItem: () => {
      throw new Error("site data blocked");
    },
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
}

afterEach(() => {
  resetTherapyCompareMemoryForTests();
});

describe("therapy compare memory", () => {
  describe("normalization", () => {
    it("keeps only trimmed, unique, non-empty strings", () => {
      expect(normalizeTherapyCompareSlugs([" cbt ", "cbt", "", "   ", "act"])).toEqual(["cbt", "act"]);
    });

    it("drops non-string entries rather than coercing them", () => {
      expect(normalizeTherapyCompareSlugs(["cbt", 7, null, undefined, { slug: "act" }, ["act"]])).toEqual(["cbt"]);
    });

    it("caps at the same ceiling the URL parser applies", () => {
      const slugs = ["a", "b", "c", "d", "e", "f"];
      expect(normalizeTherapyCompareSlugs(slugs)).toHaveLength(THERAPY_MAX_COMPARE);
      expect(normalizeTherapyCompareSlugs(slugs)).toEqual(["a", "b", "c", "d"]);
    });

    it("returns an empty list for anything that is not an array", () => {
      for (const value of [null, undefined, "cbt", 3, { 0: "cbt" }]) {
        expect(normalizeTherapyCompareSlugs(value)).toEqual([]);
      }
    });
  });

  describe("read and write", () => {
    it("round-trips a set through injected storage", () => {
      const storage = memoryStorage();
      expect(writeTherapyCompareMemory(["cbt", "act"], storage)).toEqual(["cbt", "act"]);
      expect(readTherapyCompareMemory(storage)).toEqual(["cbt", "act"]);
    });

    it("normalizes on write, so a malformed set cannot be stored", () => {
      const storage = memoryStorage();
      writeTherapyCompareMemory(["cbt", "cbt", " act ", "", "d", "e", "f"], storage);
      expect(JSON.parse(storage.store.get(therapyCompareMemoryStorageKey) ?? "[]")).toEqual(["cbt", "act", "d", "e"]);
    });

    it("persists an empty set, so Empty survives a reload", () => {
      const storage = memoryStorage();
      writeTherapyCompareMemory(["cbt", "act"], storage);
      writeTherapyCompareMemory([], storage);
      expect(storage.store.get(therapyCompareMemoryStorageKey)).toBe("[]");
      expect(readTherapyCompareMemory(storage)).toEqual([]);
    });

    it("returns an empty set when nothing has been stored", () => {
      expect(readTherapyCompareMemory(memoryStorage())).toEqual([]);
    });

    it("returns an empty set rather than throwing on malformed JSON", () => {
      const storage = memoryStorage({ [therapyCompareMemoryStorageKey]: "{not json" });
      expect(readTherapyCompareMemory(storage)).toEqual([]);
    });

    it("normalizes on read, so a hand-edited store cannot exceed the cap", () => {
      const storage = memoryStorage({
        [therapyCompareMemoryStorageKey]: JSON.stringify(["a", "a", "b", "c", "d", "e"]),
      });
      expect(readTherapyCompareMemory(storage)).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("when browser storage is unavailable", () => {
    it("degrades to this session instead of throwing", () => {
      const storage = throwingStorage();
      expect(() => writeTherapyCompareMemory(["cbt", "act"], storage)).not.toThrow();
      expect(readTherapyCompareMemory(storage)).toEqual(["cbt", "act"]);
    });

    it("does not leak the session fallback between tests", () => {
      writeTherapyCompareMemory(["cbt"], throwingStorage());
      resetTherapyCompareMemoryForTests();
      expect(readTherapyCompareMemory(throwingStorage())).toEqual([]);
    });
  });
});
