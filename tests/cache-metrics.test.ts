import { afterEach, describe, expect, it } from "vitest";

import { cacheMetricsSnapshot, recordCacheLookup, resetCacheMetrics } from "@/lib/observability/cache-metrics";

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
