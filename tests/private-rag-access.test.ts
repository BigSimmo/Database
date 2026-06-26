import { afterEach, describe, expect, it, vi } from "vitest";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";
const chunkId = "22222222-2222-4222-8222-222222222222";

const allowedRateLimit = {
  limited: false,
  limit: 100,
  remaining: 99,
  retryAfterSeconds: 0,
  resetAt: new Date(Date.now() + 60_000).toISOString(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createSupabaseMock() {
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const from = vi.fn((table: string) => ({
    insert: vi.fn(async (payload: unknown) => {
      inserts.push({ table, payload });
      return { data: null, error: null };
    }),
  }));

  return { from, inserts };
}

function sampleSearchResult() {
  return {
    id: chunkId,
    document_id: documentId,
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    section_path: ["Monitoring"],
    heading_level: 1,
    parent_heading: null,
    anchor_id: null,
    content: "Clozapine monitoring source text.",
    image_ids: [],
    similarity: 0.92,
    text_rank: 0.8,
    hybrid_score: 0.93,
    rrf_score: 0.03,
    source_strength: "strong",
    source_metadata: {
      document_status: "current",
      clinical_validation_status: "unverified",
      extraction_quality: "good",
    },
    document_labels: [],
    images: [],
  };
}

function mockRuntime(options: { demoMode?: boolean } = {}) {
  vi.resetModules();

  class MockAuthenticationError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationError";
    }
  }

  const supabase = createSupabaseMock();
  const createAdminClient = vi.fn(() => supabase);
  const requireAuthenticatedUser = vi.fn(async (request: Request) => {
    const id = request.headers.get("x-test-user");
    if (!id) throw new MockAuthenticationError();
    return { id };
  });
  const unauthorizedResponse = vi.fn(() => Response.json({ error: "Authentication required." }, { status: 401 }));
  const searchChunksWithTelemetry = vi.fn(async () => ({
    results: [sampleSearchResult()],
    telemetry: {
      query_class: "document_lookup",
      retrieval_strategy: "hybrid",
      retrieval_plan: "document_lookup:title_label_section_then_chunks",
      retrieval_query_variant_count: 2,
      search_cache_hit: false,
      embedding_skipped: false,
      embedding_skip_reason: null,
      embedding_cache_hit: false,
      text_fast_path_latency_ms: 0,
      text_candidate_budget: 24,
      text_candidate_count: 3,
      text_fast_path_reason: null,
      embedding_latency_ms: 0,
      vector_candidate_count: 5,
      embedding_field_count: 1,
      supabase_rpc_latency_ms: 0,
      rerank_latency_ms: 0,
      retrieval_provenance_counts: { chunk: 1, title: 1 },
      second_stage_rerank_used: true,
      second_stage_rerank_latency_ms: 2,
      visual_direct_image_count: 0,
      memory_card_count: 0,
      memory_top_score: 0,
      weighted_top_score: 0.93,
      rrf_top_score: 0.03,
    },
  }));
  const answerQuestionWithScope = vi.fn(async () => ({
    answer: "Source-backed answer.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
  }));
  const fetchRelatedDocuments = vi.fn(async () => []);
  const demoSearch = vi.fn(() => []);
  const demoAnswer = vi.fn(() => ({
    answer: "Demo answer.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
    routingMode: "fast",
  }));

  vi.doMock("@/lib/env", () => ({
    env: {},
    isDemoMode: () => Boolean(options.demoMode),
    isLocalNoAuthMode: () => false,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: MockAuthenticationError,
    requireAuthenticatedUser,
    unauthorizedResponse,
  }));
  vi.doMock("@/lib/api-rate-limit", async () => {
    const actual = await vi.importActual<typeof import("../src/lib/api-rate-limit")>("@/lib/api-rate-limit");
    return {
      ...actual,
      consumeApiRateLimit: vi.fn(async () => allowedRateLimit),
    };
  });
  vi.doMock("@/lib/demo-data", () => ({ demoAnswer, demoSearch }));
  vi.doMock("@/lib/rag", () => ({ answerQuestionWithScope, searchChunksWithTelemetry }));
  vi.doMock("@/lib/document-enrichment", () => ({
    fetchRelatedDocuments,
    toDocumentMatch: vi.fn((document: unknown) => document),
  }));
  vi.doMock("@/lib/evidence", () => ({
    buildSmartPanel: vi.fn(() => ({})),
    buildVisualEvidence: vi.fn(() => []),
    diversifySearchResults: vi.fn((results: unknown[]) => results),
  }));
  vi.doMock("@/lib/evidence-relevance", () => ({
    annotateDocumentMatches: vi.fn((_query: string, documents: unknown[]) => documents),
    annotateSearchResults: vi.fn((_query: string, results: unknown[]) => results),
    buildEvidenceRelevance: vi.fn(() => ({
      verdict: "direct",
      score: 0.95,
      directSourceCount: 1,
      weakSourceCount: 0,
      isSourceBacked: true,
      matchedTerms: [],
      missingTerms: [],
      chips: [],
    })),
  }));
  vi.doMock("@/lib/clinical-search", () => ({
    classifyRagQuery: vi.fn(() => ({ queryClass: "document_lookup" })),
    normalizedClinicalSearchTokens: vi.fn((query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)),
  }));
  vi.doMock("@/lib/smart-rag-api", () => ({
    buildSmartRagApiPlan: vi.fn(() => ({
      intent: "answer",
      responseMode: "clinical_answer",
      displayMode: "clinical_answer",
      sourceLinkCount: 0,
    })),
  }));
  vi.doMock("@/lib/image-filtering", () => ({
    isClinicalImageEvidence: vi.fn(() => true),
  }));

  return {
    answerQuestionWithScope,
    createAdminClient,
    demoAnswer,
    demoSearch,
    fetchRelatedDocuments,
    requireAuthenticatedUser,
    searchChunksWithTelemetry,
    supabase,
  };
}

function jsonRequest(path: string, body: Record<string, unknown>, authenticated = false) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authenticated) headers.set("x-test-user", ownerId);

  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function payload(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("private RAG API access", () => {
  it("rejects unauthenticated real search requests before retrieval", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(jsonRequest("/api/search", { query: "clozapine monitoring" }));

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Authentication required." });
    expect(mocks.searchChunksWithTelemetry).not.toHaveBeenCalled();
    expect(mocks.fetchRelatedDocuments).not.toHaveBeenCalled();
  });

  it("scopes authenticated real search requests to the authenticated owner", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(jsonRequest("/api/search", { query: "clozapine monitoring" }, true));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(mocks.searchChunksWithTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, query: "clozapine monitoring" }),
    );
    expect(mocks.fetchRelatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, query: "clozapine monitoring" }),
    );
    expect(
      mocks.supabase.inserts.some(
        ({ payload: insertPayload }) => isRecord(insertPayload) && insertPayload.owner_id === ownerId,
      ),
    ).toBe(true);
    expect(body.telemetry).toMatchObject({
      retrieval_plan: "document_lookup:title_label_section_then_chunks",
      retrieval_query_variant_count: 2,
      text_candidate_budget: 24,
      text_candidate_count: 3,
      text_fast_path_reason: null,
      embedding_skip_reason: null,
      vector_candidate_count: 5,
      embedding_field_count: 1,
      retrieval_provenance_counts: { chunk: 1, title: 1 },
      second_stage_rerank_used: true,
      second_stage_rerank_latency_ms: 2,
      visual_direct_image_count: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      mocks.supabase.inserts.some(({ payload: insertPayload }) => {
        if (!isRecord(insertPayload) || !isRecord(insertPayload.metadata)) return false;
        return (
          insertPayload.metadata.retrieval_plan === "document_lookup:title_label_section_then_chunks" &&
          insertPayload.metadata.text_candidate_budget === 24 &&
          insertPayload.metadata.second_stage_rerank_used === true
        );
      }),
    ).toBe(true);
  });

  it("keeps demo search anonymous", async () => {
    const mocks = mockRuntime({ demoMode: true });
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(jsonRequest("/api/search", { query: "demo question" }));

    expect(response.status).toBe(200);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.searchChunksWithTelemetry).not.toHaveBeenCalled();
    expect(mocks.demoSearch).toHaveBeenCalledWith("demo question", 8, undefined, undefined);
  });

  it("rejects unauthenticated real answer requests before generation", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(jsonRequest("/api/answer", { query: "clozapine monitoring" }));

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Authentication required." });
    expect(mocks.answerQuestionWithScope).not.toHaveBeenCalled();
  });

  it("scopes authenticated real answer requests to the authenticated owner", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(jsonRequest("/api/answer", { query: "clozapine monitoring" }, true));

    expect(response.status).toBe(200);
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, query: "clozapine monitoring" }),
    );
  });

  it("keeps demo answer anonymous", async () => {
    const mocks = mockRuntime({ demoMode: true });
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(jsonRequest("/api/answer", { query: "demo question" }));

    expect(response.status).toBe(200);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.answerQuestionWithScope).not.toHaveBeenCalled();
    expect(mocks.demoAnswer).toHaveBeenCalledWith("demo question", undefined, undefined);
  });

  it("rejects unauthenticated real answer streams before generation", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(jsonRequest("/api/answer/stream", { query: "clozapine monitoring" }));

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Authentication required." });
    expect(mocks.answerQuestionWithScope).not.toHaveBeenCalled();
  });

  it("scopes authenticated real answer streams to the authenticated owner", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(jsonRequest("/api/answer/stream", { query: "clozapine monitoring" }, true));
    await response.text();

    expect(response.status).toBe(200);
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, query: "clozapine monitoring" }),
    );
  });
});
