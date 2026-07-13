import { describe, expect, it } from "vitest";

import { answerSloSnapshot, type SloProbeClient } from "@/lib/observability/answer-slo";

// Fake PostgREST count builder: from().select().gt() is the "total" query; adding
// .not(column,...) narrows it to the hybrid-error or degraded count based on the
// filtered column. Awaiting resolves to { count, error }.
function fakeClient(
  counts: { total: number; hybrid: number; degraded: number },
  error?: unknown,
  observedBaseFilters: string[] = [],
): SloProbeClient {
  const build = (filter: "total" | "hybrid" | "degraded") => {
    const builder = {
      gt: () => builder,
      is: (column: string) => {
        observedBaseFilters.push(column);
        return builder;
      },
      not: (column: string) => build(column.includes("hybrid_rpc_errors") ? "hybrid" : "degraded"),
      then: (resolve: (value: { count: number | null; error: unknown }) => unknown) =>
        resolve({ count: error ? null : counts[filter], error: error ?? null }),
    };
    return builder;
  };
  return { from: () => ({ select: () => build("total") }) } as unknown as SloProbeClient;
}

describe("answerSloSnapshot", () => {
  it("computes counts and rates over the window", async () => {
    const snapshot = await answerSloSnapshot(fakeClient({ total: 20, hybrid: 3, degraded: 2 }), 60);
    expect(snapshot).toMatchObject({
      windowMinutes: 60,
      totalQueries: 20,
      hybridRpcErrorQueries: 3,
      degradedQueries: 2,
    });
    expect(snapshot.hybridRpcErrorRate).toBeCloseTo(0.15, 5);
    expect(snapshot.degradedRate).toBeCloseTo(0.1, 5);
  });

  it("counts privacy-redacted answer rows while excluding search observations by event type", async () => {
    const observedBaseFilters: string[] = [];
    const snapshot = await answerSloSnapshot(
      fakeClient({ total: 7, hybrid: 1, degraded: 2 }, undefined, observedBaseFilters),
    );

    expect(snapshot.totalQueries).toBe(7);
    expect(observedBaseFilters).toEqual(["metadata->>event_type", "metadata->>event_type", "metadata->>event_type"]);
  });

  it("reports zero rates (not NaN) when there are no queries in the window", async () => {
    const snapshot = await answerSloSnapshot(fakeClient({ total: 0, hybrid: 0, degraded: 0 }));
    expect(snapshot.totalQueries).toBe(0);
    expect(snapshot.hybridRpcErrorRate).toBe(0);
    expect(snapshot.degradedRate).toBe(0);
  });

  it("throws when a count query errors so the probe is not falsely healthy", async () => {
    await expect(
      answerSloSnapshot(fakeClient({ total: 0, hybrid: 0, degraded: 0 }, { message: "boom" })),
    ).rejects.toThrow(/boom/);
  });
});
