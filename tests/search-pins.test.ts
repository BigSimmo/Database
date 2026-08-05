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

  it("keeps the first valid pin when duplicate ids are stored", () => {
    expect(
      normalizeSearchPins([
        { id: "rounds", name: "Ward round", destinationIds: ["documents"] },
        { id: "rounds", name: "Duplicate round", destinationIds: ["forms"] },
        { id: "forms", name: "Forms", destinationIds: ["forms"] },
      ]),
    ).toEqual([
      { id: "rounds", name: "Ward round", destinationIds: ["documents"] },
      { id: "forms", name: "Forms", destinationIds: ["forms"] },
    ]);
  });

  it("falls back safely for malformed browser data", () => {
    const storage = { getItem: () => "not-json" };
    expect(readSearchPins(storage)).toEqual(defaultSearchPins);
  });

  it("returns a copy of the default pins so callers cannot mutate the shared seed", () => {
    const first = readSearchPins({ getItem: () => null });
    first[0].name = "Mutated";
    first[0].destinationIds.push("tools");
    expect(readSearchPins({ getItem: () => null })).toEqual(defaultSearchPins);
    expect(defaultSearchPins[0].name).toBe("Ward essentials");
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

  it("keeps the last normalized pins in memory when storage writes and reads fail", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };

    expect(writeSearchPins([], unavailableStorage)).toEqual([]);
    expect(readSearchPins(unavailableStorage)).toEqual([]);

    writeSearchPins(defaultSearchPins);
  });
});
