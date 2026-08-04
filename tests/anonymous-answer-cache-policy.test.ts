import { describe, expect, it } from "vitest";

import { answerCacheAllowedForOwner } from "../src/lib/rag/rag-cache";

describe("answer cache privacy policy", () => {
  it("requires a stable authenticated owner before answer caching or coalescing", () => {
    expect(answerCacheAllowedForOwner(undefined)).toBe(false);
    expect(answerCacheAllowedForOwner(null)).toBe(false);
    expect(answerCacheAllowedForOwner("")).toBe(false);
    expect(answerCacheAllowedForOwner("owner-a")).toBe(true);
  });
});
