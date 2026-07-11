import { describe, expect, it } from "vitest";

import { answerServerTimingEntries, buildServerTimingHeader } from "@/lib/server-timing";

describe("buildServerTimingHeader", () => {
  it("joins entries with durations rounded to whole milliseconds", () => {
    expect(
      buildServerTimingHeader([
        { name: "search", durMs: 120.6 },
        { name: "total", durMs: 480 },
      ]),
    ).toBe("search;dur=121, total;dur=480");
  });

  it("returns null when nothing survives sanitization", () => {
    expect(buildServerTimingHeader([])).toBeNull();
    expect(buildServerTimingHeader([{ name: "Bad Name!" }])).toBeNull();
  });

  it("drops metric names that are not conservative tokens", () => {
    expect(
      buildServerTimingHeader([
        { name: "ok-metric", durMs: 5 },
        { name: "not ok", durMs: 9 },
        { name: "UPPER", durMs: 9 },
      ]),
    ).toBe("ok-metric;dur=5");
  });

  it("clamps negative and drops non-finite durations", () => {
    expect(
      buildServerTimingHeader([
        { name: "clamped", durMs: -12 },
        { name: "nan", durMs: Number.NaN },
      ]),
    ).toBe("clamped;dur=0, nan");
  });

  it("strips header-breaking characters from descriptions", () => {
    expect(buildServerTimingHeader([{ name: "cache", desc: 'hit"\r\nmiss' }])).toBe('cache;desc="hit   miss"');
  });
});

describe("answerServerTimingEntries", () => {
  it("maps latency timings to named entries and appends the route total", () => {
    const entries = answerServerTimingEntries(
      {
        search_latency_ms: 300,
        generation_latency_ms: 2200,
        supabase_rpc_latency_ms: 180,
        total_latency_ms: 2600,
      },
      2700,
    );
    expect(buildServerTimingHeader(entries)).toBe(
      "search;dur=300, rpc;dur=180, generation;dur=2200, answer;dur=2600, total;dur=2700",
    );
  });

  it("emits only the route total when timings are missing", () => {
    expect(buildServerTimingHeader(answerServerTimingEntries(undefined, 42))).toBe("total;dur=42");
  });
});
