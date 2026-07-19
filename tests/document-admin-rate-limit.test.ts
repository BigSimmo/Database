import { afterEach, describe, expect, it, vi } from "vitest";

// Proves the `document_admin` bucket enforces a 429 on the authenticated admin
// write/read routes when the durable limiter reports the bucket exhausted. The
// routes pass `allowInMemoryFallbackOnUnavailable: true`, so a valid `limited: true`
// row is honoured directly (the fallback only engages when the limiter errors).

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const documentId = "11111111-1111-4111-8111-111111111111";

function rateLimitedClient() {
  return {
    from: vi.fn(() => {
      throw new Error("no table access should occur once the request is rate limited");
    }),
    rpc: vi.fn(async (name: string) => {
      if (name === "consume_api_rate_limit") {
        return {
          data: [
            {
              limited: true,
              limit_value: 60,
              remaining: 0,
              retry_after_seconds: 42,
              reset_at: new Date(Date.now() + 42_000).toISOString(),
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    }),
  };
}

function mockRuntime(client: ReturnType<typeof rateLimitedClient>) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      MAX_UPLOAD_MB: 150,
      SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
      SUPABASE_IMAGE_BUCKET: "clinical-images",
      RAG_SEARCH_CACHE_TTL_MS: 0,
      RAG_SEARCH_CACHE_SIZE: 0,
      RAG_ANSWER_CACHE_TTL_MS: 0,
      RAG_ANSWER_CACHE_SIZE: 0,
      RAG_AWAIT_QUERY_LOGS: false,
      WORKER_STALE_AFTER_MINUTES: 10,
      WORKER_MAX_ATTEMPTS: 3,
    },
    isDemoMode: () => false,
    isLocalNoAuthMode: () => false,
    requireOpenAIEnv: () => undefined,
    requireServerEnv: () => undefined,
  }));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
    getOptionalAuthenticatedUser: vi.fn(async () => ({ id: userId })),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: "Authentication required." }), { status: 401 }),
  }));
  vi.doMock("@/lib/rag", () => ({
    invalidateRagCachesForOwner: vi.fn(),
    invalidateRagCachesForDocumentMutation: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("document-admin rate limiting", () => {
  it("returns 429 + Retry-After when the admin bucket is exhausted, before any table access", async () => {
    const client = rateLimitedClient();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/documents/[id]/table-facts/route");

    const response = await GET(
      new Request(`http://localhost/api/documents/${documentId}/table-facts`, {
        headers: { authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({ id: documentId }) },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(body).toMatchObject({ code: "rate_limited" });
    expect(client.from).not.toHaveBeenCalled();
  });
});
