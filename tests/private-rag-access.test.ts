import { afterEach, describe, expect, it, vi } from "vitest";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";
const otherDocumentId = "33333333-3333-4333-8333-333333333333";
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
  const from = vi.fn((table: string) => {
    const filters: Array<{ column: string; value: unknown }> = [];
    const inFilters: Array<{ column: string; values: unknown[] }> = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        inFilters.push({ column, values });
        return builder;
      }),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      // Real PostgREST builders expose this; resolveSearchScope calls it whenever
      // the caller threads an AbortSignal, so the mock must model it.
      abortSignal: vi.fn(() => builder),
      insert: vi.fn(async (payload: unknown) => {
        inserts.push({ table, payload });
        return { data: null, error: null };
      }),
      then: (onfulfilled?: (value: { data: unknown; error: null }) => unknown) => {
        const explicitIds = inFilters.find((filter) => filter.column === "id")?.values as string[] | undefined;
        const ownerFilter = filters.find((filter) => filter.column === "owner_id");
        const data =
          table === "documents" && ownerFilter
            ? (explicitIds?.length ? explicitIds : [documentId])
                .filter((id) => ownerFilter.value !== null || id === documentId)
                .map((id) => ({
                  id,
                  metadata: {},
                  import_batch_id: null,
                }))
            : [];
        return Promise.resolve({ data, error: null }).then(onfulfilled);
      },
    };
    return builder;
  });

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

function mockRuntime(
  options: {
    demoMode?: boolean;
    searchResults?: unknown[];
    relatedDocuments?: unknown[];
    smartPanel?: Record<string, unknown>;
  } = {},
) {
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
  const getOptionalAuthenticatedUser = vi.fn(async (request: Request) => {
    const id = request.headers.get("x-test-user");
    return id ? { id } : null;
  });
  const unauthorizedResponse = vi.fn(() => Response.json({ error: "Authentication required." }, { status: 401 }));
  const searchChunksWithTelemetry = vi.fn(async () => ({
    results: options.searchResults ?? [sampleSearchResult()],
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
  const fetchRelatedDocuments = vi.fn(async () => options.relatedDocuments ?? []);
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
    getOptionalAuthenticatedUser,
    requireAuthenticatedUser,
    unauthorizedResponse,
  }));
  vi.doMock("@/lib/api-rate-limit", async () => {
    const actual = await vi.importActual<typeof import("../src/lib/api-rate-limit")>("@/lib/api-rate-limit");
    return {
      ...actual,
      consumeApiRateLimit: vi.fn(async () => allowedRateLimit),
      consumeSubjectApiRateLimit: vi.fn(async () => allowedRateLimit),
    };
  });
  vi.doMock("@/lib/demo-data", () => ({ demoAnswer, demoSearch }));
  vi.doMock("@/lib/rag/rag", () => ({ answerQuestionWithScope, searchChunksWithTelemetry }));
  vi.doMock("@/lib/document-enrichment", () => ({
    fetchRelatedDocuments,
    toDocumentMatch: vi.fn((document: unknown) => document),
  }));
  vi.doMock("@/lib/evidence", () => ({
    buildSmartPanel: vi.fn(() => options.smartPanel ?? {}),
    buildVisualEvidence: vi.fn(() => []),
    diversifySearchResults: vi.fn((results: unknown[]) => results),
  }));
  vi.doMock("@/lib/evidence-relevance", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../src/lib/evidence-relevance")>()),
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
    getOptionalAuthenticatedUser,
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
  it("allows unauthenticated real search requests with anonymous scope", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(jsonRequest("/api/search", { query: "clozapine monitoring" }));

    expect(response.status).toBe(200);
    expect(mocks.searchChunksWithTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined, allowGlobalSearch: true, query: "clozapine monitoring" }),
    );
    expect(mocks.fetchRelatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined, query: "clozapine monitoring" }),
    );
  });

  it("deeply projects private search evidence and keeps hidden labels suppressed", async () => {
    const sourceMetadata = {
      source_title: "Clozapine monitoring guideline",
      publisher: "WA Health",
      jurisdiction: "Australia/WA",
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: "search-uploader-private-marker",
      document_status: "current",
      clinical_validation_status: "approved",
      clinical_validation_evidence: { attested_by: "search-reviewer-private-marker" },
      extraction_quality: "good",
    };
    const visibleLabel = {
      id: "label-visible",
      document_id: documentId,
      owner_id: "search-label-owner-private-marker",
      label: "clozapine",
      label_type: "medication",
      source: "manual",
      confidence: 1,
      metadata: { review_status: "approved", reviewed_by: "search-label-reviewer-private-marker" },
    };
    const hiddenLabel = {
      ...visibleLabel,
      id: "label-hidden",
      label: "hidden-search-label-private-marker",
      metadata: { review_status: "hidden", reviewed_by: "search-hidden-reviewer-private-marker" },
    };
    const citation = {
      chunk_id: chunkId,
      document_id: documentId,
      title: "Clozapine monitoring guideline",
      file_name: "clozapine.pdf",
      page_number: 1,
      chunk_index: 0,
      source_metadata: sourceMetadata,
    };
    const relatedDocument = {
      document_id: documentId,
      title: "Clozapine monitoring guideline",
      file_name: "clozapine.pdf",
      labels: [visibleLabel, hiddenLabel],
      summary: `${"Related clinical summary. ".repeat(40)}search-summary-private-tail-marker`,
      best_pages: [1],
      best_chunk_ids: [chunkId],
      image_count: 0,
      table_count: 0,
      match_reason: "Matched label: hidden-search-label-private-marker",
      score: 0.9,
    };
    const mocks = mockRuntime({
      searchResults: [
        {
          ...sampleSearchResult(),
          source_metadata: sourceMetadata,
          document_labels: [visibleLabel, hiddenLabel],
          indexing_quality: {
            document_id: documentId,
            owner_id: "search-index-owner-private-marker",
            quality_score: 0.91,
            extraction_quality: "good",
            metrics: { raw: "search-index-metrics-private-marker" },
            issues: ["safe issue"],
          },
        },
      ],
      relatedDocuments: [relatedDocument],
      smartPanel: {
        query: "clozapine monitoring",
        total_sources: 1,
        documents: [],
        quotes: [{ ...citation, quote: "Monitor blood counts.", section_heading: "Monitoring" }],
        visualEvidence: [],
        image_count: 0,
        evidenceSummary: {
          document_count: 1,
          total_sources: 1,
          quote_count: 1,
          image_count: 0,
          source_strength: "strong",
          summary: "One strong source.",
        },
        sourceCoverage: { documents_used: 1, pages: [1], strongest_similarity: 0.92, has_images: false },
        conflictsOrGaps: [],
        future_panel_secret: "search-panel-private-marker",
      },
    });
    const { POST } = await import("../src/app/api/search/route");

    const response = await POST(
      jsonRequest("/api/search", {
        query: "clozapine monitoring",
        mode: "documents",
        includeRelatedDocuments: true,
      }),
    );
    const body = await payload(response);
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    for (const privateMarker of [
      "search-uploader-private-marker",
      "search-reviewer-private-marker",
      "search-label-owner-private-marker",
      "search-label-reviewer-private-marker",
      "hidden-search-label-private-marker",
      "search-hidden-reviewer-private-marker",
      "search-index-owner-private-marker",
      "search-index-metrics-private-marker",
      "search-summary-private-tail-marker",
      "search-panel-private-marker",
    ]) {
      expect(serialized).not.toContain(privateMarker);
    }
    expect(body).toMatchObject({
      results: [expect.objectContaining({ indexing_quality: expect.objectContaining({ metrics: {} }) })],
      relatedDocuments: [expect.objectContaining({ labels: [expect.objectContaining({ label: "clozapine" })] })],
      documentMatches: [expect.objectContaining({ labels: [expect.objectContaining({ label: "clozapine" })] })],
      smartPanel: expect.objectContaining({
        quotes: [expect.objectContaining({ source_metadata: expect.objectContaining({ uploaded_by: null }) })],
        relatedDocuments: [expect.objectContaining({ labels: [expect.objectContaining({ label: "clozapine" })] })],
      }),
    });
    expect(mocks.searchChunksWithTelemetry).toHaveBeenCalledTimes(1);
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

  it("allows unauthenticated real answer requests with anonymous scope", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(jsonRequest("/api/answer", { query: "clozapine monitoring" }));

    expect(response.status).toBe(200);
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined, allowGlobalSearch: true, query: "clozapine monitoring" }),
    );
  });

  it("does not answer anonymous requests scoped to non-public document ids", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(
      jsonRequest("/api/answer", { query: "clozapine monitoring", documentId: otherDocumentId }),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.grounded).toBe(false);
    expect(body.confidence).toBe("unsupported");
    expect(mocks.answerQuestionWithScope).not.toHaveBeenCalled();
  });

  it("silently strips legacy public skipCache from answer requests", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/route");

    const response = await POST(jsonRequest("/api/answer", { query: "clozapine monitoring", skipCache: true }));

    expect(response.status).toBe(200);
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.not.objectContaining({ skipCache: expect.anything() }),
    );
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

  it("does not dispatch resolveSearchScope before a rate-limit denial on /api/answer", async () => {
    vi.resetModules();

    class MockAuthenticationError extends Error {
      constructor() {
        super("Authentication required.");
        this.name = "AuthenticationError";
      }
    }

    const resolveSearchScope = vi.fn(async () => ({
      documentIds: [documentId],
      activeFilterCount: 1,
    }));
    let releaseRateLimit: (() => void) | undefined;
    const rateLimitGate = new Promise<void>((resolve) => {
      releaseRateLimit = resolve;
    });
    let markLimiterStarted: (() => void) | undefined;
    const limiterStarted = new Promise<void>((resolve) => {
      markLimiterStarted = resolve;
    });
    const consumeSubjectApiRateLimit = vi.fn(async () => {
      markLimiterStarted?.();
      await rateLimitGate;
      return {
        limited: true,
        limit: 30,
        remaining: 0,
        retryAfterSeconds: 60,
        resetAt: new Date(Date.now() + 60_000).toISOString(),
      };
    });

    vi.doMock("@/lib/env", () => ({
      env: {},
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => createSupabaseMock()),
    }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: MockAuthenticationError,
      getOptionalAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      requireAuthenticatedUser: vi.fn(async () => ({ id: ownerId })),
      unauthorizedResponse: vi.fn(() => Response.json({ error: "Authentication required." }, { status: 401 })),
    }));
    vi.doMock("@/lib/api-rate-limit", async () => {
      const actual = await vi.importActual<typeof import("../src/lib/api-rate-limit")>("@/lib/api-rate-limit");
      return {
        ...actual,
        consumeSubjectApiRateLimit,
      };
    });
    vi.doMock("@/lib/search-scope", async () => {
      const actual = await vi.importActual<typeof import("../src/lib/search-scope")>("@/lib/search-scope");
      return {
        ...actual,
        resolveSearchScope,
      };
    });
    vi.doMock("@/lib/rag/rag", () => ({
      answerQuestionWithScope: vi.fn(async () => {
        throw new Error("answer should not run after rate-limit denial");
      }),
    }));

    const { POST } = await import("../src/app/api/answer/route");
    const pending = POST(
      jsonRequest(
        "/api/answer",
        {
          query: "clozapine monitoring",
          filters: { labels: ["monitoring"] },
        },
        true,
      ),
    );

    // Wait until the handler has entered the limiter before asserting scope stayed idle.
    await limiterStarted;
    expect(resolveSearchScope).not.toHaveBeenCalled();

    releaseRateLimit?.();
    const response = await pending;
    expect(response.status).toBe(429);
    expect(resolveSearchScope).not.toHaveBeenCalled();
    expect(consumeSubjectApiRateLimit).toHaveBeenCalled();
  });

  it("allows unauthenticated real answer streams with anonymous scope", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(jsonRequest("/api/answer/stream", { query: "clozapine monitoring" }));
    const stream = await response.text();

    expect(response.status).toBe(200);
    expect(stream).not.toContain("event: token");
    expect(stream).not.toContain("event: revising");
    expect(stream).toContain("event: final");
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined, allowGlobalSearch: true, query: "clozapine monitoring" }),
    );
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.not.objectContaining({ onToken: expect.anything(), onRevising: expect.anything() }),
    );
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

  it("silently strips legacy public skipCache from streamed answer requests", async () => {
    const mocks = mockRuntime();
    const { POST } = await import("../src/app/api/answer/stream/route");

    const response = await POST(jsonRequest("/api/answer/stream", { query: "clozapine monitoring", skipCache: true }));
    await response.text();

    expect(response.status).toBe(200);
    expect(mocks.answerQuestionWithScope).toHaveBeenCalledWith(
      expect.not.objectContaining({ skipCache: expect.anything() }),
    );
  });
});
