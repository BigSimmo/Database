import { describe, expect, it } from "vitest";
import { ragCacheKeyMatchesOwner } from "../src/lib/rag-cache-utils";

describe("ragCacheKeyMatchesOwner", () => {
  const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("matches versioned scoped cache keys", () => {
    const key = `rag-cache-v12|${ownerId}|scope:all|plan:hybrid|class:dose`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches indexing-version cache keys", () => {
    const key = `${ownerId}|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("does not match a different owner", () => {
    const key = `rag-cache-v12|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(false);
  });
});
