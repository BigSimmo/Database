import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const publicDocumentId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("public access deep checks", () => {
  it("rejects unauthenticated access to operator-only routes", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, env: {} }));
    const auth = {
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => {
        throw new auth.AuthenticationError();
      }),
      unauthorizedResponse: () => Response.json({ error: "Authentication required." }, { status: 401 }),
    };
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
    }));
    vi.doMock("@/lib/supabase/auth", () => auth);

    const cases = [
      {
        routePath: "../src/app/api/jobs/route",
        handler: "GET" as const,
        request: new Request("http://localhost/api/jobs"),
      },
      {
        routePath: "../src/app/api/ingestion/jobs/route",
        handler: "GET" as const,
        request: new Request("http://localhost/api/ingestion/jobs"),
      },
      {
        routePath: "../src/app/api/ingestion/batches/route",
        handler: "GET" as const,
        request: new Request("http://localhost/api/ingestion/batches"),
      },
      {
        routePath: "../src/app/api/documents/bulk/route",
        handler: "POST" as const,
        request: new Request("http://localhost/api/documents/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", documentIds: [publicDocumentId] }),
        }),
      },
      {
        routePath: "../src/app/api/documents/[id]/summarize/route",
        handler: "POST" as const,
        request: new Request(`http://localhost/api/documents/${publicDocumentId}/summarize`, { method: "POST" }),
        params: { id: publicDocumentId },
      },
      {
        routePath: "../src/app/api/eval-cases/route",
        handler: "POST" as const,
        request: new Request("http://localhost/api/eval-cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "What monitoring is needed?",
            rating: "good",
            answer: "Monitor FBC.",
            queryMode: "auto",
            queryClass: "table_threshold",
          }),
        }),
      },
    ] as const;

    for (const testCase of cases) {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, env: {} }));
      vi.doMock("@/lib/supabase/admin", () => ({
        createAdminClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
      }));
      vi.doMock("@/lib/supabase/auth", () => auth);
      const mod = await import(testCase.routePath);
      const handler = mod[testCase.handler];
      const response = await handler(
        testCase.request,
        "params" in testCase ? { params: Promise.resolve(testCase.params) } : undefined,
      );
      expect(response.status, testCase.routePath).toBe(401);
    }
  });

  it("does not expose secret values from the health endpoint", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-role-key",
        OPENAI_API_KEY: "sk-super-secret-openai-key",
        HEALTH_DEEP_PROBE_SECRET: undefined,
      },
      isDemoMode: () => false,
    }));
    const { GET } = await import("../src/app/api/health/route");
    const response = await GET(new Request("https://clinical.example/api/health?deep=1"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("super-secret-service-role-key");
    expect(serialized).not.toContain("sk-super-secret-openai-key");
    expect(body.checks.supabaseConfig).toBe("ok");
    expect(body.checks.openaiConfig).toBe("ok");
    expect(body.checks.supabase).toBe("unauthorized");
  });
});

describe("production anonymous retrieval scope", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects anonymous global retrieval without allowGlobalSearch in production", async () => {
    vi.doUnmock("@/lib/rag/rag");
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      env: {
        OPENAI_API_KEY: "sk-test",
        RAG_PROVIDER_MODE: "offline",
        RAG_SEARCH_CACHE_TTL_MS: 0,
        RAG_ANSWER_CACHE_TTL_MS: 0,
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
      requestedOpenAIAnswerModels: () => ({ fast: "gpt-test", strong: "gpt-test" }),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));

    const { searchChunksWithTelemetry } = await import("../src/lib/rag/rag");

    await expect(
      searchChunksWithTelemetry({
        query: "clozapine monitoring",
      }),
    ).rejects.toThrow(/ownerId|tenant/i);
  });

  it("scopes anonymous global retrieval to public documents when allowGlobalSearch is true", async () => {
    vi.doUnmock("@/lib/rag/rag");
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/env", () => ({
      env: {
        OPENAI_API_KEY: "sk-test",
        RAG_PROVIDER_MODE: "offline",
        RAG_SEARCH_CACHE_TTL_MS: 0,
        RAG_ANSWER_CACHE_TTL_MS: 0,
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
      requestedOpenAIAnswerModels: () => ({ fast: "gpt-test", strong: "gpt-test" }),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));

    const { searchChunksWithTelemetry } = await import("../src/lib/rag/rag");
    const result = await searchChunksWithTelemetry({
      query: "clozapine monitoring",
      allowGlobalSearch: true,
    });

    expect(result.results).toEqual([]);
    expect(result.telemetry).toBeDefined();
  });
});

describe("test-runtime anonymous retrieval scope", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("allows anonymous global retrieval in test runtime where owner scope stays permissive", async () => {
    vi.doUnmock("@/lib/rag/rag");
    vi.doMock("@/lib/env", () => ({
      env: {
        OPENAI_API_KEY: undefined,
        RAG_PROVIDER_MODE: "offline",
        RAG_SEARCH_CACHE_TTL_MS: 0,
        RAG_ANSWER_CACHE_TTL_MS: 0,
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
      requestedOpenAIAnswerModels: () => ({ fast: "gpt-test", strong: "gpt-test" }),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
                in: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));

    const { searchChunksWithTelemetry } = await import("../src/lib/rag/rag");
    const result = await searchChunksWithTelemetry({
      query: "clozapine monitoring",
      allowGlobalSearch: true,
    });

    expect(result.results).toEqual([]);
    expect(result.telemetry).toBeDefined();
  });
});
