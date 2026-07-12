import { afterEach, describe, expect, it } from "vitest";

import {
  cacheMetricsSnapshot,
  classifySearchCacheOutcome,
  recordCacheLookup,
  resetCacheMetrics,
} from "@/lib/observability/cache-metrics";

afterEach(() => {
  resetCacheMetrics();
});

describe("cache metrics counter", () => {
  it("reports a zero hit-rate (not NaN) before any lookups", () => {
    expect(cacheMetricsSnapshot()).toEqual({ lookups: 0, hits: 0, misses: 0, hitRate: 0 });
  });

  it("accumulates hits and misses and derives the hit-rate", () => {
    recordCacheLookup(true);
    recordCacheLookup(true);
    recordCacheLookup(true);
    recordCacheLookup(false);

    expect(cacheMetricsSnapshot()).toEqual({ lookups: 4, hits: 3, misses: 1, hitRate: 0.75 });
  });

  it("is cumulative across calls until reset", () => {
    recordCacheLookup(false);
    expect(cacheMetricsSnapshot()).toMatchObject({ lookups: 1, hits: 0, misses: 1, hitRate: 0 });

    recordCacheLookup(true);
    expect(cacheMetricsSnapshot()).toMatchObject({ lookups: 2, hits: 1, misses: 1, hitRate: 0.5 });

    resetCacheMetrics();
    expect(cacheMetricsSnapshot()).toEqual({ lookups: 0, hits: 0, misses: 0, hitRate: 0 });
  });
});

describe("classifySearchCacheOutcome", () => {
  it("counts a process-local cache hit as a hit", () => {
    expect(classifySearchCacheOutcome(true, null)).toBe("hit");
    expect(classifySearchCacheOutcome(true, { kind: "miss" })).toBe("hit");
  });

  it("counts a shared-cache hit after a local miss as a hit (not a miss)", () => {
    // Regression: a cold process serving fully from the shared cache must not
    // deflate the hit-rate into false-degradation territory.
    expect(classifySearchCacheOutcome(false, { kind: "hit" })).toBe("hit");
  });

  it("counts a miss only when both layers were consulted and missed", () => {
    expect(classifySearchCacheOutcome(false, { kind: "miss" })).toBe("miss");
  });

  it("skips (records neither) when caching is disabled and the shared lookup returns null", () => {
    expect(classifySearchCacheOutcome(false, null)).toBe("skip");
    expect(classifySearchCacheOutcome(false, undefined)).toBe("skip");
  });
});
