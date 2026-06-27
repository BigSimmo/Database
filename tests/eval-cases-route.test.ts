import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "22222222-2222-4222-8222-222222222222";
const validChunkId = "11111111-1111-4111-8111-111111111111";
const unownedChunkId = "33333333-3333-4333-8333-333333333333";

function request(body: unknown) {
  return new Request("http://localhost/api/eval-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer valid-token" },
    body: JSON.stringify(body),
  });
}

function createSelectMock<T>(resolver: (filters: Record<string, unknown>) => T | null) {
  const filters: Record<string, unknown> = {};
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: resolver(filters), error: null })),
  };
  return builder;
}

function createInsertMock(options: {
  ownedDocumentIds?: string[];
  ownedChunks?: Record<string, string>;
} = {}) {
  const insert = vi.fn((payload: unknown) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "capture-1" }, error: null })),
    })),
    payload,
  }));
  return {
    insert,
    client: {
      from: vi.fn((table: string) => {
        if (table === "documents") {
          return createSelectMock((filters) => {
            const id = String(filters.id ?? "");
            return filters.owner_id === userId && (options.ownedDocumentIds ?? [documentId]).includes(id) ? { id } : null;
          });
        }
        if (table === "document_chunks") {
          return createSelectMock((filters) => {
            const id = String(filters.id ?? "");
            const chunkDocumentId = options.ownedChunks?.[id] ?? (id === validChunkId ? documentId : null);
            return chunkDocumentId ? { id, document_id: chunkDocumentId } : null;
          });
        }
        expect(table).toBe("rag_query_misses");
        return { insert };
      }),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockEnv(overrides: Record<string, unknown> = {}) {
  return { isDemoMode: () => false, env: { RAG_PERSIST_RAW_QUERY_TEXT: false, ...overrides } };
}

describe("/api/eval-cases", () => {
  it("captures a good answer as a promoted eval case and filters malformed chunk ids", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => mockEnv());
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/eval-cases/route");

    const response = await POST(
      request({
        query: "What monitoring is needed for clozapine?",
        rating: "good",
        answer: "Monitor FBC.",
        queryMode: "auto",
        queryClass: "table_threshold",
        sourceChunkIds: [validChunkId, "search-cache-row"],
        citedChunkIds: ["not-a-uuid", validChunkId],
        sourceFiles: ["CG.MHSP.ClozapinePresAdminMonitor.pdf", "CG.MHSP.ClozapinePresAdminMonitor.pdf"],
        expectedDocumentId: documentId,
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      owner_id: userId,
      query: "what monitoring is needed for clozapine?",
      query_class: "table_threshold",
      miss_reason: "answer_good_eval",
      top_files: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
      top_chunk_ids: [validChunkId],
      cited_chunk_ids: [validChunkId],
      expected_document_id: documentId,
      expected_chunk_id: validChunkId,
      promoted_eval_case: true,
    });
    expect(payload.metadata).toMatchObject({
      interaction: "answer_eval_capture",
      rating: "good",
      query_class: "table_threshold",
      source_chunk_ids_rejected: 1,
      cited_chunk_ids_rejected: 1,
      answer: "",
      raw_query_retained: false,
    });
    expect(typeof (payload.metadata as Record<string, unknown>).query_hash).toBe("string");
  });

  it("retains raw query and answer when RAG_PERSIST_RAW_QUERY_TEXT is true", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => mockEnv({ RAG_PERSIST_RAW_QUERY_TEXT: true }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/eval-cases/route");

    const response = await POST(
      request({
        query: "What monitoring is needed for clozapine?",
        rating: "good",
        answer: "Monitor FBC.",
        queryMode: "auto",
        queryClass: "table_threshold",
        sourceChunkIds: [],
        citedChunkIds: [],
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ query: "What monitoring is needed for clozapine?" });
    expect(payload.metadata).toMatchObject({ answer: "Monitor FBC.", raw_query_retained: true });
  });

  it("captures a needs-fixing answer without requiring expected UUID fields", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => mockEnv());
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/eval-cases/route");

    const response = await POST(
      request({
        query: "Which table covers a missing protocol?",
        rating: "needs_fixing",
        sourceChunkIds: ["generated-row"],
        citedChunkIds: [],
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      miss_reason: "answer_needs_fixing",
      top_chunk_ids: [],
      cited_chunk_ids: [],
      expected_chunk_id: null,
      promoted_eval_case: true,
    });
    expect(payload.metadata).toMatchObject({ rating: "needs_fixing", source_chunk_ids_rejected: 1 });
  });

  it("captures category-specific missed-answer feedback for eval promotion", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => mockEnv());
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/eval-cases/route");

    const response = await POST(
      request({
        query: "What ANC threshold should withhold clozapine?",
        feedbackType: "numeric_error",
        answer: "Withhold below 15.",
        queryMode: "dose_threshold_lookup",
        queryClass: "table_threshold",
        sourceChunkIds: [validChunkId],
        citedChunkIds: [validChunkId],
        sourceFiles: ["clozapine.pdf"],
        sourceGovernanceWarnings: ["Source is review due."],
        unverifiedNumericTokens: ["15"],
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      miss_reason: "numeric_error",
      promoted_eval_case: true,
    });
    expect(payload.metadata).toMatchObject({
      rating: "needs_fixing",
      feedback_type: "numeric_error",
      answer: "",
      source_governance_warnings: ["Source is review due."],
      unverified_numeric_tokens: ["15"],
      raw_query_retained: false,
    });
  });

  it("nulls unowned expected document and chunk references", async () => {
    const { client, insert } = createInsertMock({ ownedDocumentIds: [], ownedChunks: { [unownedChunkId]: documentId } });
    vi.doMock("@/lib/env", () => mockEnv());
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    }));
    const { POST } = await import("../src/app/api/eval-cases/route");

    const response = await POST(
      request({
        query: "What source was expected?",
        rating: "needs_fixing",
        expectedDocumentId: documentId,
        expectedChunkId: unownedChunkId,
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload.expected_document_id).toBeNull();
    expect(payload.expected_chunk_id).toBeNull();
  });
});
