import { describe, expect, it } from "vitest";

import {
  defaultSearchPins,
  normalizeSearchPins,
  readSearchPins,
  searchPinsStorageKey,
  writeSearchPins,
} from "@/lib/search-pins";

describe("search pin storage", () => {
  it("normalizes user-owned pin names and destination ids", () => {
    expect(
      normalizeSearchPins([
        {
          id: "rounds",
          name: "  Ward round  ",
          destinationIds: ["documents", "unknown", "documents", "forms"],
        },
      ]),
    ).toEqual([{ id: "rounds", name: "Ward round", destinationIds: ["documents", "forms"] }]);
  });

  it("falls back safely for malformed browser data", () => {
    const storage = { getItem: () => "not-json" };
    expect(readSearchPins(storage)).toEqual(defaultSearchPins);
  });

  it("writes only the normalized preference payload", () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };
    writeSearchPins([{ id: "tools", name: " Tools ", destinationIds: ["tools", "tools"] }], storage);
    expect(JSON.parse(values.get(searchPinsStorageKey) ?? "null")).toEqual([
      { id: "tools", name: "Tools", destinationIds: ["tools"] },
    ]);
  });

  it("preserves an intentionally empty pin collection", () => {
    expect(normalizeSearchPins([])).toEqual([]);
  });
});
