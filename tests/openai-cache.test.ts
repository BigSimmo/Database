import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("OpenAI query embedding cache", () => {
  it("returns repeated single-query embeddings without another OpenAI call", async () => {
    let embeddingCalls = 0;

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");
    vi.stubEnv("OPENAI_QUERY_CACHE_SIZE", "200");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn(async () => {
            embeddingCalls += 1;
            return { data: [{ embedding: [embeddingCalls, 0, 0] }] };
          }),
        };

        responses = {
          create: vi.fn(),
        };
      },
    }));

    const { clearOpenAICaches, embedTextWithTelemetry } = await import("../src/lib/openai");
    clearOpenAICaches();

    const first = await embedTextWithTelemetry("clozapine monitoring");
    const second = await embedTextWithTelemetry("clozapine monitoring");

    expect(first).toEqual({ embedding: [1, 0, 0], cacheHit: false });
    expect(second).toEqual({ embedding: [1, 0, 0], cacheHit: true });
    expect(embeddingCalls).toBe(1);
  });

  it("normalizes single-query embedding cache keys", async () => {
    let embeddingCalls = 0;

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");
    vi.stubEnv("OPENAI_QUERY_CACHE_SIZE", "200");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn(async () => {
            embeddingCalls += 1;
            return { data: [{ embedding: [embeddingCalls, 0, 0] }] };
          }),
        };

        responses = {
          create: vi.fn(),
        };
      },
    }));

    const { clearOpenAICaches, embedTextWithTelemetry } = await import("../src/lib/openai");
    clearOpenAICaches();

    const first = await embedTextWithTelemetry(" Clozapine   Monitoring ");
    const second = await embedTextWithTelemetry("clozapine monitoring");

    expect(first).toEqual({ embedding: [1, 0, 0], cacheHit: false });
    expect(second).toEqual({ embedding: [1, 0, 0], cacheHit: true });
    expect(embeddingCalls).toBe(1);
  });

  it("captures response telemetry and sends wrapper request options", async () => {
    let capturedBody: Record<string, unknown> = {};
    let capturedOptions: Record<string, unknown> = {};

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_REQUEST_TIMEOUT_MS", "1234");
    vi.stubEnv("OPENAI_MAX_RETRIES", "1");
    vi.stubEnv("OPENAI_PROMPT_CACHE_RETENTION", "24h");
    vi.stubEnv("OPENAI_STORE_RESPONSES", "false");
    vi.stubEnv("OPENAI_TEXT_VERBOSITY", "low");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn(),
        };

        responses = {
          create: vi.fn((body: Record<string, unknown>, options: Record<string, unknown>) => {
            capturedBody = body;
            capturedOptions = options;
            return {
              withResponse: async () => ({
                data: {
                  output_text: '{"answer":"ok"}',
                  usage: {
                    input_tokens: 100,
                    output_tokens: 20,
                    total_tokens: 120,
                    input_tokens_details: { cached_tokens: 64 },
                    output_tokens_details: { reasoning_tokens: 5 },
                  },
                },
                request_id: "req_123",
              }),
            };
          }),
        };
      },
    }));

    const { generateStructuredTextResult } = await import("../src/lib/openai");
    const result = await generateStructuredTextResult("Question", { type: "object", properties: {}, required: [] }, {
      model: "gpt-5.4-mini",
      operation: "answer",
      schemaName: "clinical_test",
      maxOutputTokens: 200,
    });

    expect(result.requestId).toBe("req_123");
    expect(result.usage).toMatchObject({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      cached_input_tokens: 64,
      reasoning_output_tokens: 5,
    });
    expect(capturedOptions).toMatchObject({ timeout: 1234, maxRetries: 1 });
    expect(capturedBody).toMatchObject({
      model: "gpt-5.4-mini",
      max_output_tokens: 200,
      store: false,
      prompt_cache_key: "clinical-rag-answer-v2",
      prompt_cache_retention: "24h",
      metadata: { operation: "answer" },
    });
    expect(((capturedBody.text as Record<string, unknown>).format as Record<string, unknown>).name).toBe(
      "clinical_test",
    );
  });

  it("maps OpenAI rate limits to a safe public error", async () => {
    const { mapOpenAIError } = await import("../src/lib/openai");

    const error = mapOpenAIError({ status: 429, code: "rate_limit_exceeded" }, "answer");

    expect(error.status).toBe(429);
    expect(error.message).toBe("OpenAI is rate limited. Retry in a moment.");
  });
});
