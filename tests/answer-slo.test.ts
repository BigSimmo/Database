import { describe, expect, it } from "vitest";

import { answerSloSnapshot, type SloProbeClient } from "@/lib/observability/answer-slo";

// Fake PostgREST count builder: from().select().gt() is the "total" query; adding
// .not(column,...) narrows it to the hybrid-error count, .or(filters) narrows it
// to provider-generation fallbacks, and .ilike(col, pattern) narrows it to the
// truncation or timeout fallback subset by pattern. Awaiting
// resolves to { count, error }.
type SloFilterKey = "total" | "hybrid" | "degraded" | "truncation" | "timeout";

function fakeClient(
  counts: { total: number; hybrid: number; degraded: number; truncation?: number; timeout?: number },
  error?: unknown,
  observedBaseFilters: Array<{ column: string; value: null }> = [],
  observedNarrowingFilters: Array<{ method: "eq" | "not" | "or"; column: string; value: unknown }> = [],
): SloProbeClient {
  const build = (filter: SloFilterKey) => {
    const builder = {
      gt: () => builder,
      is: (column: string, value: null) => {
        observedBaseFilters.push({ column, value });
        return builder;
      },
      eq: (column: string, value: string) => {
        observedNarrowingFilters.push({ method: "eq", column, value });
        return build("degraded");
      },
      not: (column: string, _operator: string, value: null) => {
        observedNarrowingFilters.push({ method: "not", column, value });
        return build("hybrid");
      },
      or: (filters: string) => {
        observedNarrowingFilters.push({ method: "or", column: "", value: filters });
        return build("degraded");
      },
      ilike: (_column: string, pattern: string) =>
        build(pattern.includes("max_output_tokens") ? "truncation" : "timeout"),
      then: (resolve: (value: { count: number | null; error: unknown }) => unknown) =>
        resolve({ count: error ? null : (counts[filter] ?? 0), error: error ?? null }),
    };
    return builder;
  };
  return { from: () => ({ select: () => build("total") }) } as unknown as SloProbeClient;
}

describe("answerSloSnapshot", () => {
  it("computes counts and rates over the window", async () => {
    const snapshot = await answerSloSnapshot(
      fakeClient({ total: 20, hybrid: 3, degraded: 5, truncation: 1, timeout: 4 }),
      60,
    );
    expect(snapshot).toMatchObject({
      windowMinutes: 60,
      totalQueries: 20,
      hybridRpcErrorQueries: 3,
      degradedQueries: 5,
      truncationFallbackQueries: 1,
      timeoutFallbackQueries: 4,
    });
    expect(snapshot.hybridRpcErrorRate).toBeCloseTo(0.15, 5);
    expect(snapshot.degradedRate).toBeCloseTo(0.25, 5);
    expect(snapshot.truncationFallbackRate).toBeCloseTo(0.05, 5);
    expect(snapshot.timeoutFallbackRate).toBeCloseTo(0.2, 5);
  });

  it("counts privacy-redacted answer rows while excluding search observations by event type", async () => {
    const observedBaseFilters: Array<{ column: string; value: null }> = [];
    const snapshot = await answerSloSnapshot(
      fakeClient({ total: 7, hybrid: 1, degraded: 2 }, undefined, observedBaseFilters),
    );

    expect(snapshot.totalQueries).toBe(7);
    // Five base() queries now scope by event_type: total, hybrid, degraded, truncation, timeout.
    expect(observedBaseFilters).toEqual(
      Array.from({ length: 5 }, () => ({ column: "metadata->>event_type", value: null })),
    );
  });

  it("counts only provider-generation fallbacks, not intentional source-only answers", async () => {
    const observedNarrowingFilters: Array<{
      method: "eq" | "not" | "or";
      column: string;
      value: unknown;
    }> = [];

    await answerSloSnapshot(fakeClient({ total: 7, hybrid: 1, degraded: 2 }, undefined, [], observedNarrowingFilters));

    expect(observedNarrowingFilters).toContainEqual({
      method: "or",
      column: "",
      value: "metadata->>provider_generation_degraded.eq.true,metadata->>fallback_reason.ilike.%generation_fallback:%",
    });
    expect(observedNarrowingFilters).not.toContainEqual(
      expect.objectContaining({ method: "not", column: "metadata->>fallback_reason" }),
    );
  });

  it("reports zero rates (not NaN) when there are no queries in the window", async () => {
    const snapshot = await answerSloSnapshot(fakeClient({ total: 0, hybrid: 0, degraded: 0 }));
    expect(snapshot.totalQueries).toBe(0);
    expect(snapshot.hybridRpcErrorRate).toBe(0);
    expect(snapshot.degradedRate).toBe(0);
    expect(snapshot.truncationFallbackRate).toBe(0);
    expect(snapshot.timeoutFallbackRate).toBe(0);
  });

  it("throws when a count query errors so the probe is not falsely healthy", async () => {
    await expect(
      answerSloSnapshot(fakeClient({ total: 0, hybrid: 0, degraded: 0 }, { message: "boom" })),
    ).rejects.toThrow(/boom/);
  });
});
