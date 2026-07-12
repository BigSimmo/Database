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
    expect(classifySearchCacheOutcome(true, true, null)).toBe("hit");
    expect(classifySearchCacheOutcome(true, true, { kind: "miss" })).toBe("hit");
  });

  it("counts a shared-cache hit after a local miss as a hit (not a miss)", () => {
    // Regression: a cold process serving fully from the shared cache must not
    // deflate the hit-rate into false-degradation territory.
    expect(classifySearchCacheOutcome(true, false, { kind: "hit" })).toBe("hit");
  });

  it("counts a miss only when both layers were consulted and missed", () => {
    expect(classifySearchCacheOutcome(true, false, { kind: "miss" })).toBe("miss");
  });

  it("skips the disabled search cache even when the shared lookup still ran", () => {
    // Regression: getSharedCachedSearch does not short-circuit on size, so a
    // size-0 (or TTL-0 / skipCache) deployment would otherwise record disabled
    // lookups as false misses and report a 0% hit-rate.
    expect(classifySearchCacheOutcome(false, false, { kind: "miss" })).toBe("skip");
    expect(classifySearchCacheOutcome(false, false, { kind: "hit" })).toBe("skip");
    expect(classifySearchCacheOutcome(false, false, null)).toBe("skip");
  });

  it("skips when enabled but no cache layer was consulted", () => {
    expect(classifySearchCacheOutcome(true, false, null)).toBe("skip");
    expect(classifySearchCacheOutcome(true, false, undefined)).toBe("skip");
  });
});
