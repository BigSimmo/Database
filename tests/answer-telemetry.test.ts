import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAnswerLogRow,
  buildRagQueryLogRow,
  logAnswerDiagnostics,
  type AnswerTelemetrySource,
} from "../src/lib/answer-telemetry";
import { observeRagAnswer, ragProgrammeTelemetryForAnswer } from "../src/lib/rag/rag-programme-telemetry";
import type { RagAnswer, SearchResult } from "../src/lib/types";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const INTERACTION_ID = "33333333-3333-4333-8333-333333333333";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function sourceRow(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: UUID_A,
    document_id: UUID_B,
    similarity: 0.8,
    hybrid_score: 0.85,
    ...overrides,
  } as unknown as SearchResult;
}

function answer(overrides: Partial<AnswerTelemetrySource> = {}): AnswerTelemetrySource {
  return {
    grounded: true,
    confidence: "high",
    sources: [sourceRow({})],
    queryClass: "medication_dose_risk",
    modelUsed: "gpt-5.5",
    routingMode: "strong",
    routingReason: "dose_query_strong_route",
    providerMode: "openai",
    answerQualityTier: "model_synthesis",
    responseMode: "threshold_table",
    fallbackReasonCode: null,
    fallbackReason: null,
    degradedMode: { active: false, reason: null },
    openAIUsage: {
      input_tokens: 1200,
      output_tokens: 300,
      total_tokens: 1500,
      cached_input_tokens: 800,
      reasoning_output_tokens: 120,
    },
    openAIRequestIds: ["req_1", "req_2"],
    latencyTimings: {
      generation_latency_ms: 900,
      total_latency_ms: 1400,
      answer_retry_count: 1,
      embedding_prefetched: true,
    },
    retrievalDiagnostics: undefined,
    ...overrides,
  };
}

type AnswerMetadata = { answer: Record<string, unknown> & { tokens: Record<string, number | null> } };

describe("buildAnswerLogRow (per-answer observability)", () => {
  it("P08C projects reconstructed diagnostics through one content-free allowlist", () => {
    const diagnostic = {
      required_part_count: 2,
      represented_part_count: 1,
      australian_candidate_count: 3,
      selected_site_domains: ["medications", "PRIVATE_CONTEXT_CANARY"],
      private_context: "PRIVATE_CONTEXT_CANARY",
      reviewed_input_state: "not_assessed",
    };
    const row = buildAnswerLogRow({
      query: 'Follow-up to "PRIVATE_CONTEXT_CANARY": what about this?',
      interactionId: INTERACTION_ID,
      answer: answer({ ragDiagnostics: diagnostic as never }),
    });
    const emitted = (row.metadata as unknown as { answer: { rag_diagnostics: Record<string, unknown> } }).answer
      .rag_diagnostics;
    expect(emitted).toMatchObject({
      required_part_count: 2,
      represented_part_count: 1,
      required_part_loss_count: 1,
      australian_candidate_count: 3,
      reviewed_input_state: "not_assessed",
    });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_CONTEXT_CANARY");
  });
  it("persists route, model, and token usage in metadata.answer", () => {
    const row = buildAnswerLogRow({
      query: "max clozapine dose?",
      ownerId: "owner-1",
      interactionId: INTERACTION_ID,
      answer: answer(),
    });
    const meta = row.metadata as unknown as AnswerMetadata;

    expect(meta.answer.log_source).toBe("answer");
    expect(meta.answer.route).toBe("strong");
    expect(meta.answer.model).toBe("gpt-5.5");
    expect(meta.answer.provider_mode).toBe("openai");
    expect(meta.answer.tokens).toEqual({
      input: 1200,
      output: 300,
      total: 1500,
      cached_input: 800,
      reasoning_output: 120,
    });
    expect(meta.answer.request_ids).toEqual(["req_1", "req_2"]);
    expect(meta.answer.generation_latency_ms).toBe(900);
    expect(meta.answer.embedding_prefetched).toBe(true);
    expect(meta.answer.interaction_id).toBe(INTERACTION_ID);
    expect(row.total_latency_ms).toBe(1400);
    expect(row.candidate_count).toBe(1);
    expect(row.is_miss).toBe(false);
    expect(row.owner_id).toBe("owner-1");
    // The stored query is routed through the privacy helper, not raw.
    expect(typeof row.query).toBe("string");
  });

  it("marks unsupported/ungrounded answers as a miss with a reason", () => {
    const row = buildAnswerLogRow({
      query: "unknown drug?",
      ownerId: null,
      interactionId: INTERACTION_ID,
      answer: answer({ grounded: false, confidence: "unsupported", responseMode: "evidence_gap", sources: [] }),
    });
    expect(row.is_miss).toBe(true);
    expect(row.miss_reason).toBe("evidence_gap");
    expect(row.candidate_count).toBe(0);
    expect(row.selected_chunk_ids).toEqual([]);
  });

  it("persists the bounded typed reason ahead of incompatible legacy detail", () => {
    const row = buildAnswerLogRow({
      query: "unknown drug?",
      interactionId: INTERACTION_ID,
      answer: answer({
        grounded: false,
        confidence: "unsupported",
        fallbackReasonCode: "coverage_gap",
        fallbackReason: "generation_fallback:private-host?token=secret",
        routingReason: "generation_fallback:private-host?token=secret",
      }),
    });
    const meta = row.metadata as unknown as AnswerMetadata;

    expect(meta.answer.fallback_reason_code).toBe("coverage_gap");
    expect(row.miss_reason).toBe("coverage_gap");
    expect(JSON.stringify(meta.answer)).not.toMatch(/private-host|token=secret/);
  });

  it("normalizes malformed typed reasons and persists the bounded truncation signal", () => {
    const malformed = answer({
      fallbackReasonCode: "provider_timeout\nprivate-host?token=secret" as never,
      latencyTimings: { provider_generation_truncated: true },
    });
    const retrievalRow = buildAnswerLogRow({
      query: "unknown drug?",
      interactionId: INTERACTION_ID,
      answer: malformed,
    });
    const retrievalMetadata = retrievalRow.metadata as unknown as AnswerMetadata;
    expect(retrievalMetadata.answer.fallback_reason_code).toBe("unknown");
    expect(retrievalMetadata.answer.provider_generation_truncated).toBe(true);

    const programmeTelemetry = observeRagAnswer(
      { ...malformed, answer: "Source-backed response.", citations: [] } as RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );
    const queryRow = buildRagQueryLogRow({
      query: "unknown drug?",
      interactionId: INTERACTION_ID,
      answer: programmeTelemetry,
      programmeTelemetry: ragProgrammeTelemetryForAnswer(programmeTelemetry)!,
    });
    expect(queryRow.metadata).toMatchObject({
      fallback_reason_code: "unknown",
      provider_generation_truncated: true,
    });
  });

  it("drops non-UUID chunk/document ids from the selected arrays", () => {
    const row = buildAnswerLogRow({
      query: "q",
      ownerId: "o",
      interactionId: INTERACTION_ID,
      answer: answer({
        sources: [sourceRow({ id: "synthetic-chunk", document_id: "synthetic-doc" }), sourceRow({ id: UUID_A })],
      }),
    });
    expect(row.selected_chunk_ids).toEqual([UUID_A]);
    expect(row.selected_document_ids).toEqual([UUID_B]);
  });

  it("nulls non-finite token and latency values rather than persisting them", () => {
    const row = buildAnswerLogRow({
      query: "q",
      ownerId: "o",
      interactionId: INTERACTION_ID,
      answer: answer({ openAIUsage: {}, latencyTimings: {} }),
    });
    const meta = row.metadata as unknown as AnswerMetadata;
    expect(meta.answer.tokens).toEqual({
      input: null,
      output: null,
      total: null,
      cached_input: null,
      reasoning_output: null,
    });
    expect(row.total_latency_ms).toBeNull();
  });

  it("writes one final answer aggregate and one retrieval row joined by the route id", async () => {
    const inserts = new Map<string, unknown>();
    const supabase = {
      from: (table: string) => ({
        insert: async (row: unknown) => {
          inserts.set(table, row);
          return { error: null };
        },
      }),
    };
    const observed = observeRagAnswer(
      {
        ...answer(),
        answer: "Final governed answer.",
        citations: [],
      } as RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );

    await logAnswerDiagnostics({
      supabase: supabase as never,
      query: "max clozapine dose?",
      ownerId: "owner-1",
      interactionId: INTERACTION_ID,
      answer: observed,
    });

    const queryRow = inserts.get("rag_queries") as { metadata: Record<string, unknown> };
    const retrievalRow = inserts.get("rag_retrieval_logs") as {
      metadata: { answer: Record<string, unknown> };
    };
    expect(queryRow.metadata.interaction_id).toBe(INTERACTION_ID);
    expect(retrievalRow.metadata.answer.interaction_id).toBe(INTERACTION_ID);
    expect(queryRow.metadata).not.toHaveProperty("owner_id");
  });

  it("awaits both joined inserts when RAG_AWAIT_QUERY_LOGS is enabled", async () => {
    vi.resetModules();
    vi.stubEnv("RAG_AWAIT_QUERY_LOGS", "true");
    const telemetry = await import("../src/lib/answer-telemetry");
    const programme = await import("../src/lib/rag/rag-programme-telemetry");
    const gate = deferred();
    const started: string[] = [];
    const completed: string[] = [];
    const supabase = {
      from: (table: string) => ({
        insert: async () => {
          started.push(table);
          await gate.promise;
          completed.push(table);
          return { error: null };
        },
      }),
    };
    const observed = programme.observeRagAnswer(
      { ...answer(), answer: "Final governed answer.", citations: [] } as RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );

    let settled = false;
    const write = telemetry
      .persistAnswerDiagnostics({
        supabase: supabase as never,
        query: "max clozapine dose?",
        ownerId: "owner-1",
        interactionId: INTERACTION_ID,
        answer: observed,
      })
      .then(() => {
        settled = true;
      });
    await vi.waitFor(() => expect(started).toHaveLength(2));

    expect(settled).toBe(false);
    expect(completed).toEqual([]);
    gate.resolve();
    await write;
    expect(completed).toHaveLength(2);
  });

  it("retains fire-and-forget completion when RAG_AWAIT_QUERY_LOGS is disabled", async () => {
    vi.resetModules();
    vi.stubEnv("RAG_AWAIT_QUERY_LOGS", "false");
    const telemetry = await import("../src/lib/answer-telemetry");
    const programme = await import("../src/lib/rag/rag-programme-telemetry");
    const gate = deferred();
    const completed: string[] = [];
    const supabase = {
      from: (table: string) => ({
        insert: async () => {
          await gate.promise;
          completed.push(table);
          return { error: null };
        },
      }),
    };
    const observed = programme.observeRagAnswer(
      { ...answer(), answer: "Final governed answer.", citations: [] } as RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );

    await telemetry.persistAnswerDiagnostics({
      supabase: supabase as never,
      query: "max clozapine dose?",
      ownerId: "owner-1",
      interactionId: INTERACTION_ID,
      answer: observed,
    });

    expect(completed).toEqual([]);
    gate.resolve();
    await vi.waitFor(() => expect(completed).toHaveLength(2));
  });
});
