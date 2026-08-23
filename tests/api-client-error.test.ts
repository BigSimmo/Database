import { describe, expect, it } from "vitest";
import { parseApiErrorPayload, parseApiErrorResponse } from "../src/lib/api-client-error";

describe("parseApiErrorPayload", () => {
  it("accepts the strict canonical envelope", () => {
    expect(
      parseApiErrorPayload(
        JSON.stringify({
          error: "Not found.",
          message: "Not found.",
          code: "not_found",
          requestId: "req_123",
        }),
      ),
    ).toEqual({ error: "Not found.", message: "Not found.", code: "not_found", requestId: "req_123" });
  });

  it("retains an explicit fallback for legacy error and details envelopes", () => {
    expect(
      parseApiErrorPayload(
        JSON.stringify({ message: "Unavailable", details: { code: "provider_unavailable", retryAfterSeconds: 2 } }),
      ),
    ).toMatchObject({
      message: "Unavailable",
      details: { code: "provider_unavailable", retryAfterSeconds: 2 },
    });
  });

  it("rejects malformed canonical candidates instead of downgrading them to legacy", () => {
    expect(
      parseApiErrorPayload(
        JSON.stringify({
          error: "Request failed.",
          message: "Request failed.",
          code: "internal_error",
          internalCause: "database password",
        }),
      ),
    ).toBeNull();
  });
});

describe("parseApiErrorResponse", () => {
  it.each([401, 403])("does not retry protected status %s", async (status) => {
    const error = await parseApiErrorResponse(
      new Response(JSON.stringify({ message: "Sign in", code: "auth" }), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(error).toMatchObject({ status, code: "auth", message: "Sign in", retryable: false });
  });
  it("preserves a 429 message and Retry-After delay", async () => {
    const error = await parseApiErrorResponse(
      new Response(JSON.stringify({ error: "Wait before retrying", code: "rate_limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "7" },
      }),
    );
    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryable: true, retryAfterMs: 7000 });
  });
  it("uses typed canonical rate-limit details when the header is unavailable", async () => {
    const error = await parseApiErrorResponse(
      new Response(
        JSON.stringify({
          error: "Wait before retrying",
          message: "Wait before retrying",
          code: "rate_limited",
          details: {
            kind: "rate_limit",
            retryAfterSeconds: 5,
            resetAt: "2026-08-23T00:00:05.000Z",
          },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );
    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfterMs: 5000 });
  });
  it("safely parses an SSE error fallback", async () => {
    const response = new Response(
      'event: error\ndata: {"message":"Unavailable","status":503,"details":{"code":"provider_unavailable"}}\n\n',
      { status: 503, headers: { "content-type": "text/event-stream" } },
    );
    await expect(parseApiErrorResponse(response)).resolves.toMatchObject({
      status: 503,
      code: "provider_unavailable",
      message: "Unavailable",
      retryable: true,
    });
  });
  it("does not surface malformed JSON error bodies as user-facing text", async () => {
    const error = await parseApiErrorResponse(
      new Response(JSON.stringify({ error: 42, internalCause: "database password" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(error).toMatchObject({ status: 500, code: "http_500", message: "Request failed (500)" });
  });
});
