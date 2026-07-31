import { describe, expect, it } from "vitest";
import { ragCacheKeyMatchesOwner } from "../src/lib/rag/rag-cache-utils";

describe("ragCacheKeyMatchesOwner", () => {
  const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("matches versioned scoped cache keys", () => {
    const key = `rag-cache-v13|${ownerId}|scope:all|plan:hybrid|class:dose`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches indexing-version cache keys", () => {
    const key = `${ownerId}|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches owner-plus-public cache keys", () => {
    const key = `rag-cache-v13|owner:${ownerId}+public|scope:all|plan:hybrid`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches owner-plus-public indexing-version keys", () => {
    const key = `owner:${ownerId}+public|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("does not match a different owner", () => {
    const key = `rag-cache-v13|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(false);
  });

  it("does not match an owner id prefix", () => {
    const key = `rag-cache-v13|owner:${ownerId}0+public|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(false);
  });
});
