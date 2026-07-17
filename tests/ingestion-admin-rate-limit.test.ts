import { afterEach, describe, expect, it, vi } from "vitest";

// Proves the `ingestion_admin` bucket enforces a 429 on the authenticated
// ingestion/eval admin routes when the durable limiter reports the bucket
// exhausted. The routes pass `allowInMemoryFallbackOnUnavailable: true`, so a
// valid `limited: true` row is honoured directly (the fallback only engages when
// the limiter errors).

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
              retry_after_seconds: 37,
              reset_at: new Date(Date.now() + 37_000).toISOString(),
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
      RAG_PERSIST_RAW_QUERY_TEXT: false,
      RAG_PERSIST_ANSWER_TEXT: false,
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
    unauthorizedResponse: () => new Response(JSON.stringify({ error: "Authentication required." }), { status: 401 }),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("ingestion-admin rate limiting", () => {
  it("returns 429 + Retry-After on the ingestion-quality route when the bucket is exhausted, before any table access", async () => {
    const client = rateLimitedClient();
    mockRuntime(client);
    const { GET } = await import("../src/app/api/ingestion/quality/route");

    const response = await GET(
      new Request("http://localhost/api/ingestion/quality", {
        headers: { authorization: "Bearer valid-token" },
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(body).toMatchObject({ code: "rate_limited" });
    expect(client.from).not.toHaveBeenCalled();
  });
});
