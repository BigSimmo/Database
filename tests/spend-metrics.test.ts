import { describe, expect, it } from "vitest";

import {
  computeAnswerCostUsd,
  type SpendPricing,
  type SpendProbeClient,
  spendSnapshot,
} from "@/lib/observability/spend-metrics";

const PRICING: SpendPricing = { inputPerMTok: 1, cachedInputPerMTok: 0.1, outputPerMTok: 10 };

type FakeRow = {
  query_class?: string | null;
  metadata?: { answer?: { route?: string; model?: string; tokens?: Record<string, number> } };
};

// Fake PostgREST select builder: from().select().gt().eq().limit() resolves to
// { data, error }. Mirrors the answer-slo test's structural fake.
function fakeClient(rows: FakeRow[], error?: unknown): SpendProbeClient {
  const builder = {
    gt: () => builder,
    eq: () => builder,
    limit: () => builder,
    then: (resolve: (value: { data: FakeRow[] | null; error: unknown }) => unknown) =>
      resolve({ data: error ? null : rows, error: error ?? null }),
  };
  return { from: () => ({ select: () => builder }) } as unknown as SpendProbeClient;
}

const answerRow = (route: string, model: string, tokens: Record<string, number>): FakeRow => ({
  metadata: { answer: { route, model, tokens } },
});

describe("computeAnswerCostUsd", () => {
  it("bills uncached input, cached input, and output at their rates", () => {
    // 1M uncached input @1 + 1M cached @0.1 is impossible (cached ⊆ input); use a subset.
    const usd = computeAnswerCostUsd({ input: 1_000_000, cached_input: 200_000, output: 1_000_000 }, PRICING);
    // uncached 800k @1 + cached 200k @0.1 + output 1M @10 = 0.8 + 0.02 + 10 = 10.82
    expect(usd).toBeCloseTo(0.8 + 0.02 + 10, 6);
  });

  it("never counts cached input beyond total input", () => {
    const usd = computeAnswerCostUsd({ input: 100, cached_input: 500, output: 0 }, PRICING);
    // cached clamped to 100 → all cached → 100 @0.1 / 1e6
    expect(usd).toBeCloseTo((100 * 0.1) / 1_000_000, 9);
  });

  it("treats missing/NaN token fields as zero", () => {
    expect(computeAnswerCostUsd({}, PRICING)).toBe(0);
  });
});

describe("spendSnapshot", () => {
  it("aggregates tokens and USD, split by route and model", async () => {
    const rows = [
      answerRow("fast", "gpt-5.5", { input: 1000, cached_input: 0, output: 500, reasoning_output: 100, total: 1500 }),
      answerRow("strong", "gpt-5.5", {
        input: 2000,
        cached_input: 500,
        output: 4000,
        reasoning_output: 3000,
        total: 6000,
      }),
    ];
    const snap = await spendSnapshot(fakeClient(rows), { windowMinutes: 60, pricing: PRICING });

    expect(snap.answers).toBe(2);
    expect(snap.tokens.input).toBe(3000);
    expect(snap.tokens.output).toBe(4500);
    expect(snap.tokens.reasoningOutput).toBe(3100);
    // fast: 1000@1 + 500@10 = 0.001 + 0.005 = 0.006
    // strong: uncached 1500@1 + cached 500@0.1 + 4000@10 = 0.0015 + 0.00005 + 0.04 = 0.04155
    expect(snap.usd).toBeCloseTo(0.006 + 0.04155, 6);
    expect(snap.usdByRoute.fast).toBeCloseTo(0.006, 6);
    expect(snap.usdByRoute.strong).toBeCloseTo(0.04155, 6);
    expect(snap.usdByModel).toHaveLength(1);
    expect(snap.usdByModel[0].model).toBe("gpt-5.5");
    expect(snap.usdByModel[0].answers).toBe(2);
  });

  it("projects a daily rate from a short window and flags the alert", async () => {
    const rows = [answerRow("strong", "gpt-5.5", { input: 0, output: 1_000_000 })]; // $10 in the window
    const snap = await spendSnapshot(fakeClient(rows), {
      windowMinutes: 60,
      pricing: PRICING,
      alertDailyUsd: 100,
    });
    // $10/hour → $240/day > $100 threshold
    expect(snap.projectedDailyUsd).toBeCloseTo(240, 2);
    expect(snap.alerting).toBe(true);
  });

  it("does not alert when under threshold or when threshold is 0/disabled", async () => {
    const rows = [answerRow("fast", "gpt-5.5", { input: 100, output: 100 })];
    const under = await spendSnapshot(fakeClient(rows), { windowMinutes: 60, pricing: PRICING, alertDailyUsd: 1000 });
    expect(under.alerting).toBe(false);
    const disabled = await spendSnapshot(fakeClient(rows), { windowMinutes: 60, pricing: PRICING, alertDailyUsd: 0 });
    expect(disabled.alertDailyUsdThreshold).toBeNull();
    expect(disabled.alerting).toBe(false);
  });

  it("returns a zeroed snapshot for an empty window without dividing by zero", async () => {
    const snap = await spendSnapshot(fakeClient([]), { windowMinutes: 60, pricing: PRICING, alertDailyUsd: 10 });
    expect(snap.answers).toBe(0);
    expect(snap.usd).toBe(0);
    expect(snap.projectedDailyUsd).toBe(0);
    expect(snap.alerting).toBe(false);
    expect(snap.sampleTruncated).toBe(false);
  });

  it("flags a truncated sample when the row cap is hit", async () => {
    const rows = [
      answerRow("fast", "gpt-5.5", { input: 1, output: 1 }),
      answerRow("fast", "gpt-5.5", { input: 1, output: 1 }),
    ];
    const snap = await spendSnapshot(fakeClient(rows), { windowMinutes: 60, pricing: PRICING, rowCap: 2 });
    expect(snap.sampleTruncated).toBe(true);
  });

  it("throws on a query error so the caller can null the block", async () => {
    await expect(
      spendSnapshot(fakeClient([], { message: "boom" }), { windowMinutes: 60, pricing: PRICING }),
    ).rejects.toThrow("boom");
  });
});
