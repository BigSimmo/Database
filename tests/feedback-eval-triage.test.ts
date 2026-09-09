import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { classifyFeedbackForEval } from "../src/lib/rag/feedback-eval-triage";
import {
  buildFeedbackReadPlan,
  runFeedbackReport,
  type FeedbackReportDependencies,
  type FeedbackReadClient,
} from "../scripts/report-answer-feedback";
import { expectedSupabaseProject } from "../src/lib/supabase/project";

const id = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-09-08T12:00:00.000Z");
const start = "2026-09-07T00:00:00.000Z";
const end = "2026-09-08T00:00:00.000Z";
const metadata = { generation_outcome: "generated", required_part_count: 2, represented_part_count: 1 };
const categories = [
  "verified",
  "needs_correction",
  "source_insufficient",
  "wrong_source",
  "missing_source",
  "unsupported_answer",
  "numeric_error",
  "outdated_guidance",
];
const project = expectedSupabaseProject.ref;
const planArgs = ["--project-ref", project, "--confirm-project-ref", project, "--from", start, "--to", end];
const liveArgs = ["--live", ...planArgs, "--authorization-receipt", "receipt.json"];
const config = {
  NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
  SUPABASE_PROJECT_REF: project,
  SUPABASE_PROJECT_NAME: expectedSupabaseProject.name,
};
const plan = () => buildFeedbackReadPlan({ projectRef: project, from: start, to: end }, now);
const receipt = () => ({
  version: "provider-authorization-v1",
  operation: "answer_feedback_eval_triage_read",
  projectRef: project,
  planDigest: plan().planDigest,
  authorizedAt: "2026-09-08T11:59:00.000Z",
  expiresAt: "2026-09-08T12:10:00.000Z",
});
const exportData = () => ({
  version: "answer-feedback-export-v1",
  feedback: [{ interactionId: id, category: "numeric_error" }],
  answers: [{ interactionId: id, ...metadata }],
  retrievals: [{ interactionId: id, ...metadata }],
});

function deps(json: unknown = exportData()) {
  return {
    readJson: vi.fn(async () => json),
    loadConfig: vi.fn(async () => config),
    createClient: vi.fn(async () => {
      throw new Error("must not create a client");
    }),
    now: () => now,
  } satisfies FeedbackReportDependencies;
}

function mockLive(
  responses: Array<{ data: unknown; error?: unknown; count?: unknown }> = [
    { data: [{ interaction_id: id, feedback_category: "numeric_error" }] },
    { data: [{ interactionId: id, ...metadata }] },
    { data: [{ interactionId: id, ...metadata }] },
  ],
) {
  const calls: Array<{ table: string; operations: Array<[string, ...unknown[]]> }> = [];
  const client = {
    from(table: string) {
      const entry = { table, operations: [] as Array<[string, ...unknown[]]> };
      calls.push(entry);
      const result = responses.shift() ?? { data: [] };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "gte", "lt", "eq", "in", "order", "range", "limit", "abortSignal", "retry"]) {
        query[method] = (...args: unknown[]) => {
          entry.operations.push([method, ...args]);
          return query;
        };
      }
      query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve({ error: null, count: Array.isArray(result.data) ? result.data.length : null, ...result }).then(
          resolve,
          reject,
        );
      return query;
    },
  } as unknown as FeedbackReadClient;
  const dependencies = { ...deps(receipt()), createClient: vi.fn(async () => client) };
  return { calls, dependencies };
}

describe("feedback triage has no promotion authority", () => {
  it.each(categories)("preserves %s compatibility and review boundaries", (category) => {
    const result = classifyFeedbackForEval({
      feedback: { interactionId: id, category },
      answerMetadata: metadata,
      retrievalMetadata: metadata,
    });
    expect(result).toMatchObject({
      interactionId: id,
      category,
      requiresDeidentificationReview: true,
      mayAutoPromote: false,
    });
    expect(result.recommendedAction).toBe(
      category === "verified"
        ? "aggregate_only"
        : ["numeric_error", "outdated_guidance"].includes(category)
          ? "clinical_review"
          : "candidate_eval_case",
    );
    expect(result.diagnosticReasonCodes).toContain(`feedback_${category}`);
    expect(result.diagnosticReasonCodes).toContain("answer_coverage_part_loss");
  });

  it.each([
    null,
    {},
    [],
    { ...metadata, generation_outcome: "private provider failure" },
    { ...metadata, represented_part_count: 3 },
  ])("marks absent or malformed diagnostic sides incomplete: %j", (bad) => {
    const result = classifyFeedbackForEval({
      feedback: { interactionId: id, category: "numeric_error" },
      answerMetadata: bad as Record<string, unknown> | null,
      retrievalMetadata: metadata,
    });
    expect(result.recommendedAction).toBe("request_reproduction");
    expect(result.diagnosticReasonCodes).toContain(
      bad === null ? "answer_metadata_missing" : "answer_metadata_incomplete",
    );
  });

  it("does not expose raw fields, arbitrary categories, IDs or errors", () => {
    const poison = "PRIVATE_SENTINEL";
    const result = classifyFeedbackForEval({
      feedback: { interactionId: poison, category: poison },
      answerMetadata: {
        ...metadata,
        query: poison,
        answer: poison,
        owner_id: poison,
        provider_error: poison,
        content: poison,
        reviewed_input_state: "reviewed",
      },
      retrievalMetadata: metadata,
    });
    expect(JSON.stringify(result)).not.toContain(poison);
    expect(result.recommendedAction).toBe("request_reproduction");
    expect(result.interactionId).toBe("");
  });

  it("keeps verified aggregate-only even when both telemetry sides are absent", () => {
    const result = classifyFeedbackForEval({
      feedback: { interactionId: id, category: "verified" },
      answerMetadata: null,
      retrievalMetadata: null,
    });
    expect(result.recommendedAction).toBe("aggregate_only");
    expect(result.diagnosticReasonCodes).toEqual(
      expect.arrayContaining(["answer_metadata_missing", "retrieval_metadata_missing"]),
    );
  });

  it("requires reproduction when diagnostic sides disagree", () => {
    const result = classifyFeedbackForEval({
      feedback: { interactionId: id, category: "numeric_error" },
      answerMetadata: metadata,
      retrievalMetadata: { ...metadata, generation_outcome: "extractive" },
    });
    expect(result.recommendedAction).toBe("request_reproduction");
    expect(result.diagnosticReasonCodes).toContain("telemetry_metadata_conflict");
  });
});

describe("report defaults to local export and stdout only", () => {
  it("reports sanitized aggregates and candidate IDs without loading configuration or clients", async () => {
    const input = exportData();
    Object.assign(input.answers[0]!, {
      query: "PRIVATE_SENTINEL",
      owner_id: "PRIVATE_SENTINEL",
      provider_error: "PRIVATE_SENTINEL",
    });
    const dependencies = deps(input);
    const result = await runFeedbackReport(["--input", "synthetic.json"], dependencies);
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({
      status: "complete",
      totalFeedback: 1,
      candidateInteractionIds: [id],
      requiresDeidentificationReview: true,
      mayAutoPromote: false,
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
    expect(dependencies.loadConfig).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it.each(["answers", "retrievals", "feedback"] as const)(
    "marks duplicate %s incomplete rather than selecting a winner",
    async (side) => {
      const input = exportData();
      input[side].push({ ...input[side][0]! } as never);
      const result = await runFeedbackReport(["--input", "synthetic.json"], deps(input));
      expect(result.output).toMatchObject({ candidateInteractionIds: [], incompleteRecords: 1 });
      expect(JSON.stringify(result.output)).toContain(
        `${side === "answers" ? "answer" : side === "retrievals" ? "retrieval" : "feedback"}_join_ambiguous`,
      );
    },
  );

  it("requires a local export and rejects malformed or oversized populations without echoing content", async () => {
    for (const input of [
      null,
      { ...exportData(), version: "PRIVATE_SENTINEL" },
      { ...exportData(), feedback: Array(201).fill(exportData().feedback[0]) },
    ]) {
      const result = await runFeedbackReport(["--input", "synthetic.json"], deps(input));
      expect(result.exitCode).not.toBe(0);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
    }
  });
});

describe("bounded action-specific read approval", () => {
  it("prints a reviewable deterministic plan with no receipt, credentials, client or input read", async () => {
    const dependencies = deps();
    const result = await runFeedbackReport(["--print-plan", ...planArgs], dependencies);
    expect(result.exitCode).toBe(0);
    expect(result.output).toEqual(plan());
    expect(dependencies.readJson).not.toHaveBeenCalled();
    expect(dependencies.loadConfig).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
    expect(plan().limits).toMatchObject({
      maxFeedbackRows: 200,
      feedbackPageSize: 50,
      maxFeedbackPages: 5,
      joinBatchSize: 50,
      maxJoinRowsPerBatch: 100,
      joinSentinelLimit: 101,
      maxJoinRequests: 8,
      maxRequests: 13,
      maxWindowMs: 604800000,
      maxReceiptValidityMs: 900000,
    });
  });

  it.each([
    { name: "missing mode", argv: [] },
    { name: "incomplete live arguments", argv: ["--live"] },
    { name: "mixed input and live", argv: ["--input", "x", "--live"] },
    { name: "duplicate input flag", argv: ["--input", "x", "--input", "x"] },
    { name: "mixed live and print-plan", argv: ["--live", "--print-plan", ...planArgs] },
    { name: "output override", argv: ["--input", "x", "--out", "x"] },
    { name: "row limit override", argv: ["--print-plan", ...planArgs, "--max-rows", "999"] },
    { name: "receipt in print-plan", argv: ["--print-plan", ...planArgs, "--authorization-receipt", "x"] },
    { name: "missing input value", argv: ["--input", "--live"] },
    { name: "unknown sensitive argument", argv: ["--wat", "PRIVATE_SENTINEL"] },
  ])("rejects $name with zero client construction", async ({ argv }) => {
    const dependencies = deps(receipt());
    const result = await runFeedbackReport(argv, dependencies);
    expect(result).toMatchObject({
      exitCode: 1,
      output: { status: "refused", reasonCode: "FEEDBACK_ARGUMENTS_INVALID" },
    });
    expect(dependencies.loadConfig).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
  });

  it.each([
    { version: "wrong" },
    { operation: "site_content_sync_handoff" },
    { projectRef: "wrong" },
    { planDigest: "0".repeat(64) },
    { authorizedAt: "2026-09-08T12:01:00.000Z" },
    { expiresAt: "2026-09-08T12:00:00.000Z" },
    { authorizedAt: "2026-09-08T11:00:00.000Z" },
    { authorizedAt: "yesterday" },
    { extra: true },
  ])("rejects mismatched receipt before configuration/client access: %j", async (patch) => {
    const dependencies = deps({ ...receipt(), ...patch });
    expect((await runFeedbackReport(liveArgs, dependencies)).exitCode).not.toBe(0);
    expect(dependencies.loadConfig).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { ...config, SUPABASE_PROJECT_NAME: undefined },
    { ...config, SUPABASE_PROJECT_REF: "wrong" },
    ...["http://", "https://user@"].map((prefix) => ({
      ...config,
      NEXT_PUBLIC_SUPABASE_URL: `${prefix}${project}.supabase.co`,
    })),
    ...[":444", "/rest/v1", "?x=y", "#x", ":443"].map((suffix) => ({
      ...config,
      NEXT_PUBLIC_SUPABASE_URL: `${expectedSupabaseProject.url}${suffix}`,
    })),
  ])("rejects incomplete, warning, mismatched or noncanonical identity with no client: %j", async (identity) => {
    const { dependencies, calls } = mockLive();
    dependencies.loadConfig.mockResolvedValue(identity as typeof config);
    expect((await runFeedbackReport(liveArgs, dependencies)).exitCode).not.toBe(0);
    expect(dependencies.createClient).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each([
    { from: end, to: start },
    { from: "2026-08-01T00:00:00.000Z", to: end },
    { from: start, to: "2026-09-09T00:00:00.000Z" },
    { from: "2026-09-07", to: end },
  ])("rejects invalid windows before client creation: %j", async (window) => {
    expect(() => buildFeedbackReadPlan({ projectRef: project, ...window }, now)).toThrow();
  });

  it("binds exact projections into approval and issues only finite diagnostic reads", async () => {
    const { dependencies, calls } = mockLive();
    const result = await runFeedbackReport(liveArgs, dependencies);
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({ candidateInteractionIds: [id] });
    expect(calls.map((call) => call.table)).toEqual(["rag_answer_feedback", "rag_queries", "rag_retrieval_logs"]);
    expect(calls[0]!.operations).toEqual(
      expect.arrayContaining([
        ["select", "interaction_id,feedback_category", { count: "exact" }],
        ["gte", "created_at", start],
        ["lt", "created_at", end],
        ["range", 0, 49],
      ]),
    );
    const answerProjection =
      "interactionId:metadata->>interaction_id,generation_outcome:metadata->rag_diagnostics->>generation_outcome,required_part_count:metadata->rag_diagnostics->required_part_count,represented_part_count:metadata->rag_diagnostics->represented_part_count";
    const retrievalProjection =
      "interactionId:metadata->answer->>interaction_id,generation_outcome:metadata->answer->rag_diagnostics->>generation_outcome,required_part_count:metadata->answer->rag_diagnostics->required_part_count,represented_part_count:metadata->answer->rag_diagnostics->represented_part_count";
    expect(calls[1]!.operations).toEqual(
      expect.arrayContaining([
        ["select", answerProjection, { count: "exact" }],
        ["in", "metadata->>interaction_id", [id]],
        ["limit", 101],
      ]),
    );
    expect(calls[2]!.operations).toEqual(
      expect.arrayContaining([
        ["select", retrievalProjection, { count: "exact" }],
        ["in", "metadata->answer->>interaction_id", [id]],
        ["eq", "metadata->answer->>log_source", "answer"],
        ["limit", 101],
      ]),
    );
    expect(JSON.stringify(plan())).toContain(answerProjection);
    expect(JSON.stringify(plan())).toContain(retrievalProjection);
    expect(calls.every((call) => call.operations.some(([method]) => method === "abortSignal"))).toBe(true);
    expect(
      calls.every((call) => call.operations.some(([method, value]) => method === "retry" && value === false)),
    ).toBe(true);
  });

  it("suppresses arbitrary provider errors and discards partial reports on exhaustion", async () => {
    const failed = mockLive([{ data: null, error: { message: "PRIVATE_SENTINEL" } }]);
    const result = await runFeedbackReport(liveArgs, failed.dependencies);
    expect(result).toMatchObject({ exitCode: 1, output: { status: "failed", reasonCode: "FEEDBACK_READ_FAILED" } });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
    const full = Array.from({ length: 50 }, (_, i) => ({
      interaction_id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      feedback_category: "numeric_error",
    }));
    const exhausted = mockLive(Array.from({ length: 5 }, () => ({ data: full })));
    const over = await runFeedbackReport(liveArgs, exhausted.dependencies);
    expect(over.exitCode).not.toBe(0);
    expect(JSON.stringify(over.output)).not.toContain("candidateInteractionIds");
    expect(exhausted.calls.length).toBeLessThanOrEqual(5);
  });

  it("treats missing and ambiguous live joins as incomplete", async () => {
    const mocked = mockLive([
      { data: [{ interaction_id: id, feedback_category: "numeric_error" }] },
      { data: [] },
      {
        data: [
          { interactionId: id, ...metadata },
          { interactionId: id, ...metadata },
        ],
      },
    ]);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result.output).toMatchObject({ candidateInteractionIds: [], incompleteRecords: 1 });
  });

  it.each([null, 101, 2])("refuses a capped, missing-count or inconsistent telemetry batch: %j", async (count) => {
    const mocked = mockLive([
      { data: [{ interaction_id: id, feedback_category: "numeric_error" }] },
      { data: [{ interactionId: id, ...metadata }], count },
    ]);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result.exitCode).toBe(1);
    expect(JSON.stringify(result.output)).not.toContain("candidateInteractionIds");
    expect(mocked.calls).toHaveLength(2);
  });

  it("refuses changed projection approvals before configuration or client creation", async () => {
    const { planDigest: _digest, ...changed } = plan();
    changed.joins[0]!.projection += ",metadata";
    const dependencies = deps({
      ...receipt(),
      planDigest: createHash("sha256").update(JSON.stringify(changed)).digest("hex"),
    });
    expect((await runFeedbackReport(liveArgs, dependencies)).exitCode).toBe(1);
    expect(dependencies.loadConfig).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it("refuses generic provider permission without an action receipt", async () => {
    vi.stubEnv("ALLOW_PROVIDER_TESTS", "true");
    try {
      const dependencies = deps({});
      expect((await runFeedbackReport(liveArgs, dependencies)).exitCode).toBe(1);
      expect(dependencies.createClient).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("stops after receipt expiry during a request and emits no partial candidates", async () => {
    const mocked = mockLive();
    let ticks = 0;
    mocked.dependencies.now = () => (++ticks <= 4 ? now : now + 16 * 60_000);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result.exitCode).toBe(1);
    expect(mocked.calls).toHaveLength(1);
    expect(JSON.stringify(result.output)).not.toContain("candidateInteractionIds");
  });

  it("refuses a feedback page shortened by a server cap", async () => {
    const mocked = mockLive([{ data: [{ interaction_id: id, feedback_category: "numeric_error" }], count: 50 }]);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result.exitCode).toBe(1);
    expect(mocked.calls).toHaveLength(1);
  });

  it("reads exactly 200 feedback IDs using at most 13 requests and four batches per side", async () => {
    const all = Array.from({ length: 200 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`);
    const responses: Array<{ data: unknown[]; count: number }> = [];
    for (let offset = 0; offset < 200; offset += 50)
      responses.push({
        data: all
          .slice(offset, offset + 50)
          .map((interaction_id) => ({ interaction_id, feedback_category: "numeric_error" })),
        count: 200,
      });
    responses.push({ data: [], count: 200 });
    for (let offset = 0; offset < 200; offset += 50) {
      const data = all.slice(offset, offset + 50).map((interactionId) => ({ interactionId, ...metadata }));
      responses.push({ data, count: 50 }, { data, count: 50 });
    }
    const mocked = mockLive(responses);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({ candidateInteractionIds: all, totalFeedback: 200, incompleteRecords: 0 });
    expect(mocked.calls).toHaveLength(13);
    expect(mocked.calls.filter((call) => call.table === "rag_queries")).toHaveLength(4);
  });

  it("fails the whole live scan on overlapping feedback pages before any telemetry joins", async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => ({
      interaction_id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      feedback_category: "numeric_error",
    }));
    const uniqueTelemetry = firstPage.map((row) => ({ interactionId: row.interaction_id, ...metadata }));
    const mocked = mockLive([
      { data: firstPage, count: 51 },
      { data: [firstPage[49]!], count: 51 },
      { data: uniqueTelemetry, count: 50 },
      { data: uniqueTelemetry, count: 50 },
    ]);
    const result = await runFeedbackReport(liveArgs, mocked.dependencies);
    expect(result).toMatchObject({ exitCode: 1, output: { status: "failed", reasonCode: "FEEDBACK_READ_EXHAUSTED" } });
    expect(JSON.stringify(result.output)).not.toContain("candidateInteractionIds");
    expect(mocked.calls.map((call) => call.table)).toEqual(["rag_answer_feedback", "rag_answer_feedback"]);
  });

  it("forwards guarded reads through the actual default adapter with mocked file and Supabase boundaries", async () => {
    const mocked = mockLive();
    const upstream = await mocked.dependencies.createClient();
    const createClient = vi.fn(() => upstream);
    const payload = Buffer.from(JSON.stringify(receipt()));
    const open = vi.fn(async () => {
      let position = 0;
      return {
        stat: async () => ({ isFile: () => true, size: payload.length }),
        read: async (buffer: Buffer, offset: number, length: number) => {
          const bytesRead = payload.copy(buffer, offset, position, position + length);
          position += bytesRead;
          return { bytesRead, buffer };
        },
        close: vi.fn(async () => {}),
      };
    });
    vi.doMock("node:fs/promises", () => ({ open }));
    vi.doMock("@supabase/supabase-js", () => ({ createClient }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", expectedSupabaseProject.url);
    vi.stubEnv("SUPABASE_PROJECT_REF", project);
    vi.stubEnv("SUPABASE_PROJECT_NAME", expectedSupabaseProject.name);
    vi.stubEnv("SUPABASE_STAGING_PROJECT_REF", "");
    vi.stubEnv("SUPABASE_STAGING_PROJECT_NAME", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-key");
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      vi.resetModules();
      const { runFeedbackReport: runDefault } = await import("../scripts/report-answer-feedback");
      const result = await runDefault(liveArgs);
      expect(result).toMatchObject({ exitCode: 0, output: { status: "complete", candidateInteractionIds: [id] } });
      expect(open).toHaveBeenCalledWith(expect.any(String), "r");
      expect(createClient).toHaveBeenCalledWith(expectedSupabaseProject.url, "synthetic-test-key", {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: expect.any(Function) },
      });
      expect(mocked.calls.map((call) => call.table)).toEqual([
        "rag_answer_feedback",
        "rag_queries",
        "rag_retrieval_logs",
      ]);
      expect(
        mocked.calls.every((call) => call.operations.some(([method, value]) => method === "retry" && value === false)),
      ).toBe(true);
      expect(
        mocked.calls.every((call) =>
          call.operations.some(([method, value]) => method === "abortSignal" && value instanceof AbortSignal),
        ),
      ).toBe(true);
      expect(JSON.stringify(result.output)).not.toContain("synthetic-test-key");
    } finally {
      clock.mockRestore();
      vi.unstubAllEnvs();
      vi.doUnmock("node:fs/promises");
      vi.doUnmock("@supabase/supabase-js");
      vi.resetModules();
    }
  });
});
