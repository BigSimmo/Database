import { describe, expect, it, vi } from "vitest";
import {
  aggregateProfileSamples,
  buildProfileEvidencePayload,
  extractPlanMetrics,
  parseProfileArgs,
  percentile,
  phaseForSample,
  profileRetrievalUsage,
  profileOwnerScope,
  profileRpcResultIsComplete,
  profileRpcSequentially,
  safeProfileResultKey,
  sanitizeProfileError,
  sanitizeProfileText,
  type ProfileSample,
} from "../scripts/profile-retrieval-rpcs";
import { DEFAULT_EVAL_OWNER_ID } from "../scripts/eval-utils";

const emptyEnvironment: Record<string, string | undefined> = {};

function sample(overrides: Partial<ProfileSample>): ProfileSample {
  return {
    index: 1,
    phase: "first_unprimed",
    client_round_trip_ms: 10,
    planning_time_ms: 1,
    execution_time_ms: 5,
    buffers: {
      shared_hit: 0,
      shared_read: 0,
      shared_dirtied: 0,
      shared_written: 0,
      temp_read: 0,
      temp_written: 0,
    },
    plan_node_types: ["Result"],
    index_names: [],
    ...overrides,
  };
}

describe("retrieval RPC profiler arguments", () => {
  it("keeps the one-sample default and parses a positive sequential sample count", () => {
    expect(parseProfileArgs([], emptyEnvironment)).toMatchObject({ samples: 1, matchCount: 24, analyze: false });
    expect(
      parseProfileArgs(
        ["--samples", "6", "--match-count", "12", "--rpc", "match_document_table_facts_text", "--analyze"],
        emptyEnvironment,
      ),
    ).toMatchObject({
      samples: 6,
      matchCount: 12,
      rpcs: ["match_document_table_facts_text"],
      analyze: true,
    });
  });

  it.each(["0", "-1", "1.5", "not-a-number"])("rejects invalid --samples %s", (value) => {
    expect(() => parseProfileArgs(["--samples", value], emptyEnvironment)).toThrow(
      "--samples must be a positive integer.",
    );
  });

  it("rejects empty lists and unknown options", () => {
    expect(() => parseProfileArgs(["--rpc", ","], emptyEnvironment)).toThrow(
      "--rpc must include at least one RPC name.",
    );
    expect(() => parseProfileArgs(["--document-ids", ","], emptyEnvironment)).toThrow(
      "--document-ids must include at least one document ID.",
    );
    expect(() => parseProfileArgs(["--unknown", "value"], emptyEnvironment)).toThrow("Unknown option");
    expect(() => parseProfileArgs(["--rpc", "operator@example.test"], emptyEnvironment)).toThrow(
      "Unsupported retrieval RPC: [REDACTED_EMAIL]",
    );
  });

  it("lets an explicit owner selector replace the environment default without cross-owner ambiguity", () => {
    const environment = {
      RAG_EVAL_OWNER_ID: "11111111-1111-4111-8111-111111111111",
      RAG_EVAL_OWNER_EMAIL: "environment@example.test",
    };
    expect(parseProfileArgs(["--owner-email", "requested@example.test"], environment)).toMatchObject({
      ownerEmail: "requested@example.test",
      ownerId: undefined,
    });
    expect(parseProfileArgs(["--owner-id", "22222222-2222-4222-8222-222222222222"], environment)).toMatchObject({
      ownerEmail: undefined,
      ownerId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("documents first/unprimed rather than claiming a cold sample", () => {
    expect(profileRetrievalUsage).toContain("first_unprimed");
    expect(profileRetrievalUsage).toContain("never claims a true cold sample");
  });
});

describe("retrieval RPC plan parsing", () => {
  it("recursively records plan shape, index names, timings, and root buffer totals", () => {
    const plan = [
      {
        Plan: {
          "Node Type": "Limit",
          "Shared Hit Blocks": 21,
          "Shared Read Blocks": 3,
          "Shared Dirtied Blocks": 2,
          "Shared Written Blocks": 1,
          "Temp Read Blocks": 5,
          "Temp Written Blocks": 4,
          Plans: [
            {
              "Node Type": "Bitmap Heap Scan",
              Plans: [{ "Node Type": "Bitmap Index Scan", "Index Name": "document_table_facts_search_gin" }],
            },
          ],
        },
        "Planning Time": 0.75,
        "Execution Time": 68.25,
      },
    ];

    expect(extractPlanMetrics(plan)).toEqual({
      planning_time_ms: 0.75,
      execution_time_ms: 68.25,
      buffers: {
        shared_hit: 21,
        shared_read: 3,
        shared_dirtied: 2,
        shared_written: 1,
        temp_read: 5,
        temp_written: 4,
      },
      plan_node_types: ["Bitmap Heap Scan", "Bitmap Index Scan", "Limit"],
      index_names: ["document_table_facts_search_gin"],
    });
  });

  it("accepts JSON text and handles empty or malformed plans", () => {
    expect(extractPlanMetrics(JSON.stringify([{ Plan: { "Node Type": "Result" } }])).plan_node_types).toEqual([
      "Result",
    ]);
    expect(extractPlanMetrics(null)).toEqual({
      planning_time_ms: null,
      execution_time_ms: null,
      buffers: {
        shared_hit: 0,
        shared_read: 0,
        shared_dirtied: 0,
        shared_written: 0,
        temp_read: 0,
        temp_written: 0,
      },
      plan_node_types: [],
      index_names: [],
    });
    expect(extractPlanMetrics("not-json")).not.toHaveProperty("raw_plan");
  });

  it.each([
    "Filter query_text = 'ordinary unstructured operator input'",
    "Filter owner_id = '11111111-1111-4111-8111-111111111111'",
    "operator@example.test",
    "Authorization: Bearer secret-value",
    "Filter password=hunter2",
    "Filter credential=opaquevalue",
    "Filter passphrase=opaquevalue",
  ])("never persists a raw plan, including for sensitive or ordinary literals: %s", (filter) => {
    const metrics = extractPlanMetrics([{ Plan: { "Node Type": "Result", Filter: filter } }]);
    expect(metrics).not.toHaveProperty("raw_plan");
    expect(metrics.plan_node_types).toEqual(["Result"]);
  });
});

describe("retrieval RPC sample classification and aggregates", () => {
  it("classifies only sample one as first/unprimed", () => {
    expect(phaseForSample(1)).toBe("first_unprimed");
    expect(phaseForSample(2)).toBe("warm_repeat");
    expect(() => phaseForSample(0)).toThrow("positive integer");
  });

  it("uses deterministic nearest-rank percentiles", () => {
    expect(percentile([], 0.9)).toBeNull();
    expect(percentile([40, 10, 20, 30], 0.5)).toBe(20);
    expect(percentile([40, 10, 20, 30], 0.9)).toBe(40);
  });

  it("isolates first/unprimed from warm median, p90, max, and error counts", () => {
    const samples = [
      sample({ client_round_trip_ms: 100, execution_time_ms: 80 }),
      sample({ index: 2, phase: "warm_repeat", client_round_trip_ms: 20, execution_time_ms: 10 }),
      sample({ index: 3, phase: "warm_repeat", client_round_trip_ms: 40, execution_time_ms: 30 }),
      sample({
        index: 4,
        phase: "warm_repeat",
        client_round_trip_ms: 30,
        planning_time_ms: null,
        execution_time_ms: null,
        error: { code: "timeout", message: "timed out" },
      }),
    ];
    expect(aggregateProfileSamples(samples)).toMatchObject({
      sample_count: 4,
      success_count: 3,
      error_count: 1,
      first_unprimed: { client_round_trip_ms: 100 },
      warm_repeat: {
        sample_count: 3,
        success_count: 2,
        error_count: 1,
        client_round_trip_ms: { median: 30, p90: 40, max: 40 },
        execution_time_ms: { median: 10, p90: 30, max: 30 },
      },
    });
  });

  it("executes requested samples sequentially and records per-sample phases", async () => {
    let active = 0;
    let maximumActive = 0;
    const rpc = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return { data: [{ Plan: { "Node Type": "Result" }, "Execution Time": 2 }], error: null };
    });
    const clock = [0, 5, 5, 15, 15, 30];
    const result = await profileRpcSequentially(
      { rpc },
      "match_document_table_facts_text",
      parseProfileArgs(["--samples", "3"], emptyEnvironment),
      DEFAULT_EVAL_OWNER_ID,
      () => clock.shift()!,
    );

    expect(maximumActive).toBe(1);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "explain_retrieval_rpc",
      expect.objectContaining({ p_owner_filter: DEFAULT_EVAL_OWNER_ID }),
    );
    expect(
      result.samples.map(({ index, phase, client_round_trip_ms }) => ({ index, phase, client_round_trip_ms })),
    ).toEqual([
      { index: 1, phase: "first_unprimed", client_round_trip_ms: 5 },
      { index: 2, phase: "warm_repeat", client_round_trip_ms: 10 },
      { index: 3, phase: "warm_repeat", client_round_trip_ms: 15 },
    ]);
  });

  it("omits PHI-capable query text and labels the sentinel as public scope", () => {
    const args = parseProfileArgs(["--query", "Jane Sample record 42 review"], emptyEnvironment);
    const payload = buildProfileEvidencePayload(args, {}, true, DEFAULT_EVAL_OWNER_ID, "2026-07-27T00:00:00.000Z");
    expect(payload).toMatchObject({ query_recorded: false, owner_scope: "public_scope", status: "complete" });
    expect(payload).not.toHaveProperty("query");
    expect(JSON.stringify(payload)).not.toContain("Jane Sample record 42 review");
    expect(profileOwnerScope("22222222-2222-4222-8222-222222222222")).toBe("owner_scoped");
  });

  it("records a sanitized thrown RPC error and continues later samples", async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(new Error("owner 11111111-1111-4111-8111-111111111111 failed for operator@example.test"))
      .mockResolvedValueOnce({ data: [{ Plan: { "Node Type": "Result" } }], error: null });
    const clock = [0, 1, 1, 2];
    const result = await profileRpcSequentially(
      { rpc },
      "match_document_table_facts_text",
      parseProfileArgs(["--samples", "2"], emptyEnvironment),
      "11111111-1111-4111-8111-111111111111",
      () => clock.shift()!,
    );

    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].error?.message).not.toMatch(/11111111|operator@/);
    expect(result.samples[1]).not.toHaveProperty("error");
    expect(profileRpcResultIsComplete(result, { samples: 2, analyze: false })).toBe(false);
  });

  it("requires every requested analyze sample to include execution timing", () => {
    expect(
      profileRpcResultIsComplete(
        { samples: [sample({})], aggregate: aggregateProfileSamples([sample({})]) },
        { samples: 1, analyze: true },
      ),
    ).toBe(true);
    const missingTiming = sample({ execution_time_ms: null });
    expect(
      profileRpcResultIsComplete(
        { samples: [missingTiming], aggregate: aggregateProfileSamples([missingTiming]) },
        { samples: 1, analyze: true },
      ),
    ).toBe(false);
    expect(
      profileRpcResultIsComplete(
        { samples: [missingTiming], aggregate: aggregateProfileSamples([missingTiming]) },
        { samples: 1, analyze: false },
      ),
    ).toBe(true);
  });

  it("records a bounded sample error when EXPLAIN ANALYZE omits execution timing", async () => {
    const result = await profileRpcSequentially(
      { rpc: vi.fn().mockResolvedValue({ data: [{ Plan: { "Node Type": "Result" } }], error: null }) },
      "match_document_table_facts_text",
      parseProfileArgs(["--samples", "1", "--analyze"], emptyEnvironment),
      undefined,
      vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(5),
    );

    expect(result.samples[0].error).toEqual({
      code: "missing_analyze_execution_time",
      message: "EXPLAIN ANALYZE did not return an execution time.",
    });
    expect(result.aggregate).toMatchObject({ error_count: 1, success_count: 0 });
    expect(profileRpcResultIsComplete(result, { samples: 1, analyze: true })).toBe(false);
  });

  it.each([null, [], "not-json"])("rejects an empty or malformed EXPLAIN payload: %j", async (data) => {
    const result = await profileRpcSequentially(
      { rpc: vi.fn().mockResolvedValue({ data, error: null }) },
      "match_document_table_facts_text",
      parseProfileArgs(["--samples", "1"], emptyEnvironment),
      DEFAULT_EVAL_OWNER_ID,
      vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(5),
    );

    expect(result.samples[0].error).toEqual({
      code: "missing_explain_plan",
      message: "EXPLAIN did not return a parseable plan.",
    });
    expect(result.aggregate).toMatchObject({ error_count: 1, success_count: 0 });
    expect(profileRpcResultIsComplete(result, { samples: 1, analyze: false })).toBe(false);
  });
});

describe("retrieval RPC profiler redaction", () => {
  it("redacts credentials, emails, and UUIDs from persisted text", () => {
    const text = sanitizeProfileText(
      "operator@example.test owner 11111111-1111-4111-8111-111111111111 Authorization: Bearer secret-value password=hunter2 token=opaquevalue credential:opaquevalue",
    );
    expect(text).toContain("[REDACTED_EMAIL]");
    expect(text).toContain("[REDACTED_UUID]");
    expect(text).toContain("Bearer [REDACTED]");
    expect(text).not.toContain("operator@example.test");
    expect(text).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(text).not.toMatch(/hunter2|opaquevalue/);
    expect(text).toContain("password=[REDACTED]");
    expect(text).toContain("token=[REDACTED]");
    expect(text).toContain("credential=[REDACTED]");
  });

  it("returns a bounded stable error without identity", () => {
    const error = sanitizeProfileError({
      code: "PGRST-123 unsafe",
      message:
        "Failed for operator@example.test and 11111111-1111-4111-8111-111111111111 with api_key=sk-abcdefghijklmnopqrstuvwxyz password=hunter2",
    });
    expect(error.code).toBe("PGRST-123_unsafe");
    expect(error.message).not.toMatch(/operator@|11111111|sk-|hunter2/);
    expect(error.message.length).toBeLessThanOrEqual(500);
  });

  it("sanitizes persisted result keys even before the RPC allowlist is applied", () => {
    const key = safeProfileResultKey("operator@example.test/11111111-1111-4111-8111-111111111111 token=secret");
    expect(key).not.toMatch(/operator@|11111111|secret/);
    expect(key).toContain("REDACTED_EMAIL");
    expect(key).toContain("REDACTED_UUID");
  });
});
