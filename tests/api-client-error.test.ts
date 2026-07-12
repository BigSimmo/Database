import { describe, expect, it } from "vitest";
import { parseApiErrorResponse } from "../src/lib/api-client-error";

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
});
