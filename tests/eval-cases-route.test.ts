import { afterEach, describe, expect, it, vi } from "vitest";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const validChunkId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new Request("http://localhost/api/eval-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer valid-token" },
    body: JSON.stringify(body),
  });
}

function createInsertMock() {
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

describe("/api/eval-cases", () => {
  it("captures a good answer as a promoted eval case and filters malformed chunk ids", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
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
      }),
    );
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      owner_id: userId,
      query_class: "table_threshold",
      miss_reason: "answer_good_eval",
      top_files: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
      top_chunk_ids: [validChunkId],
      cited_chunk_ids: [validChunkId],
      expected_chunk_id: validChunkId,
      promoted_eval_case: true,
    });
    expect(payload.metadata).toMatchObject({
      interaction: "answer_eval_capture",
      rating: "good",
      query_class: "table_threshold",
      source_chunk_ids_rejected: 1,
      cited_chunk_ids_rejected: 1,
    });
  });

  it("captures a needs-fixing answer without requiring expected UUID fields", async () => {
    const { client, insert } = createInsertMock();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
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
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
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
      source_governance_warnings: ["Source is review due."],
      unverified_numeric_tokens: ["15"],
    });
  });
});
