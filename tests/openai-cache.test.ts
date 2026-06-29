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
    // EMBEDDING_DIMENSIONS matches the 3-element mock vector (IDX-C2 guard).
    vi.stubEnv("EMBEDDING_DIMENSIONS", "3");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          // Include `index` to mirror the real embeddings API contract (IDX-C1).
          create: vi.fn(async () => {
            embeddingCalls += 1;
            return { data: [{ index: 0, embedding: [embeddingCalls, 0, 0] }] };
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
    // EMBEDDING_DIMENSIONS matches the 3-element mock vector (IDX-C2 guard).
    vi.stubEnv("EMBEDDING_DIMENSIONS", "3");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          // Include `index` to mirror the real embeddings API contract (IDX-C1).
          create: vi.fn(async () => {
            embeddingCalls += 1;
            return { data: [{ index: 0, embedding: [embeddingCalls, 0, 0] }] };
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
    vi.stubEnv("OPENAI_GENERATION_MAX_RETRIES", "1");
    vi.stubEnv("OPENAI_PROMPT_CACHE_RETENTION", "24h");
    vi.stubEnv("OPENAI_STORE_RESPONSES", "false");
    vi.stubEnv("OPENAI_TEXT_VERBOSITY", "low");
    vi.stubEnv("OPENAI_STRONG_ANSWER_MODEL", "gpt-5.5");
    vi.stubEnv("OPENAI_STRONG_REASONING_EFFORT", "high");

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
    const controller = new AbortController();
    const result = await generateStructuredTextResult(
      "Question",
      { type: "object", properties: {}, required: [] },
      {
        model: "gpt-5.5",
        operation: "answer",
        schemaName: "clinical_test",
        maxOutputTokens: 200,
        signal: controller.signal,
      },
    );

    expect(result.requestId).toBe("req_123");
    expect(result.usage).toMatchObject({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      cached_input_tokens: 64,
      reasoning_output_tokens: 5,
    });
    expect(capturedOptions).toMatchObject({ timeout: 1234, maxRetries: 1, signal: controller.signal });
    expect(capturedBody).toMatchObject({
      model: "gpt-5.5",
      max_output_tokens: 200,
      store: false,
      prompt_cache_key: "clinical-rag-answer-v2",
      prompt_cache_retention: "24h",
      metadata: { operation: "answer" },
      reasoning: { effort: "high" },
    });
    expect(capturedBody.text).toMatchObject({
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "clinical_test",
        strict: true,
        schema: { type: "object", properties: {}, required: [] },
      },
    });
  });

  it("applies model capability rules for reasoning and verbosity", async () => {
    const capturedBodies: Record<string, unknown>[] = [];

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_STORE_RESPONSES", "false");
    vi.stubEnv("OPENAI_TEXT_VERBOSITY", "medium");
    vi.stubEnv("OPENAI_STRONG_ANSWER_MODEL", "gpt-5.5");
    vi.stubEnv("OPENAI_STRONG_REASONING_EFFORT", "high");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = { create: vi.fn() };
        responses = {
          create: vi.fn((body: Record<string, unknown>) => {
            capturedBodies.push(body);
            return {
              withResponse: async () => ({
                data: { status: "completed", output_text: '{"answer":"ok"}' },
                request_id: `req_${capturedBodies.length}`,
              }),
            };
          }),
        };
      },
    }));

    const { generateStructuredTextResult } = await import("../src/lib/openai");
    const schema = { type: "object", properties: {}, required: [] };

    await generateStructuredTextResult("Question", schema, {
      model: "gpt-5.5",
      operation: "answer",
      schemaName: "clinical_test",
      maxOutputTokens: 200,
    });
    await generateStructuredTextResult("Question", schema, {
      model: "gpt-5.5",
      operation: "answer",
      schemaName: "clinical_test",
      maxOutputTokens: 200,
      reasoningEffort: "xhigh",
    });
    await generateStructuredTextResult("Question", schema, {
      model: "gpt-5.4-mini",
      operation: "answer",
      schemaName: "clinical_test",
      maxOutputTokens: 200,
      reasoningEffort: "high",
    });
    await generateStructuredTextResult("Question", schema, {
      model: "gpt-4.1-mini",
      operation: "answer",
      schemaName: "clinical_test",
      maxOutputTokens: 200,
      reasoningEffort: "high",
    });

    expect(capturedBodies[0]).toMatchObject({
      model: "gpt-5.5",
      reasoning: { effort: "high" },
      text: expect.objectContaining({ verbosity: "medium" }),
    });
    expect(capturedBodies[1]).toMatchObject({
      model: "gpt-5.5",
      reasoning: { effort: "xhigh" },
      text: expect.objectContaining({ verbosity: "medium" }),
    });
    expect(capturedBodies[2]).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning: { effort: "high" },
      text: expect.objectContaining({ verbosity: "medium" }),
    });
    expect(capturedBodies[3]).toMatchObject({
      model: "gpt-4.1-mini",
      text: expect.objectContaining({ format: expect.any(Object) }),
    });
    expect(capturedBodies[3]).not.toHaveProperty("reasoning");
    expect(capturedBodies[3].text as Record<string, unknown>).not.toHaveProperty("verbosity");
    expect(JSON.stringify(capturedBodies)).not.toContain("minimal");
  });

  it("flags truncated (incomplete) responses (GEN-C1)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = { create: vi.fn() };
        responses = {
          create: vi.fn(() => ({
            withResponse: async () => ({
              data: {
                status: "incomplete",
                incomplete_details: { reason: "max_output_tokens" },
                output_text: '{"answer":"Withhold clozapine if ANC below',
              },
              request_id: "req_trunc",
            }),
          })),
        };
      },
    }));

    const { generateStructuredTextResult } = await import("../src/lib/openai");
    const result = await generateStructuredTextResult(
      "Question",
      { type: "object", properties: {}, required: [] },
      { model: "gpt-5.4-mini", operation: "answer", schemaName: "clinical_test", maxOutputTokens: 50 },
    );

    expect(result.truncated).toBe(true);
    expect(result.status).toBe("incomplete");
    expect(result.incompleteReason).toBe("max_output_tokens");
  });

  it("marks a completed response as not truncated (GEN-C1)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = { create: vi.fn() };
        responses = {
          create: vi.fn(() => ({
            withResponse: async () => ({
              data: { status: "completed", output_text: '{"answer":"ok"}' },
              request_id: "req_ok",
            }),
          })),
        };
      },
    }));

    const { generateStructuredTextResult } = await import("../src/lib/openai");
    const result = await generateStructuredTextResult(
      "Question",
      { type: "object", properties: {}, required: [] },
      { model: "gpt-5.4-mini", operation: "answer", schemaName: "clinical_test", maxOutputTokens: 200 },
    );

    expect(result.truncated).toBe(false);
    expect(result.status).toBe("completed");
  });

  it("applies configured vision image detail to image inputs", async () => {
    let capturedBody: Record<string, unknown> = {};

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_VISION_MODEL", "gpt-5.5");
    vi.stubEnv("OPENAI_VISION_IMAGE_DETAIL", "low");

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = { create: vi.fn() };
        responses = {
          create: vi.fn((body: Record<string, unknown>) => {
            capturedBody = body;
            return {
              withResponse: async () => ({
                data: { status: "completed", output_text: "Clinical table caption." },
                request_id: "req_vision_detail",
              }),
            };
          }),
        };
      },
    }));

    const { captionImageFromBase64 } = await import("../src/lib/openai");
    const caption = await captionImageFromBase64({
      base64: "ZmFrZQ==",
      mimeType: "image/png",
      nearbyText: "Monitoring table",
    });

    expect(caption).toBe("Clinical table caption.");
    const input = capturedBody.input as Array<{ content: Array<Record<string, unknown>> }>;
    expect(input[0]?.content.find((part) => part.type === "input_image")).toMatchObject({ detail: "low" });
  });

  it("maps OpenAI rate limits to a safe public error", async () => {
    const { mapOpenAIError } = await import("../src/lib/openai");

    const error = mapOpenAIError({ status: 429, code: "rate_limit_exceeded" }, "answer");

    expect(error.status).toBe(429);
    expect(error.message).toBe("OpenAI is rate limited. Retry in a moment.");
  });
});
