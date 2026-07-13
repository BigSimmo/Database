import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";
import { captureClientException, registerSentryClient } from "@/lib/observability/sentry-client";

describe("scrubSentryEvent — clinical PII contract", () => {
  it("strips request cookies, query string, body and sensitive headers", () => {
    const scrubbed = scrubSentryEvent({
      request: {
        url: "https://app.example/api/answer",
        cookies: { session: "secret-cookie" },
        query_string: "query=patient+with+chest+pain",
        data: { query: "patient with chest pain" },
        headers: { authorization: "Bearer abc", accept: "text/html" },
      },
    });

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.headers?.authorization).toBe("[redacted]");
    // Non-sensitive header survives (note: any header whose name matches the PII
    // key list — e.g. "content-type" via "content" — is intentionally redacted).
    expect(scrubbed.request?.headers?.accept).toBe("text/html");
  });

  it("drops user identity and redacts sensitive extra/context keys", () => {
    const scrubbed = scrubSentryEvent({
      user: { email: "patient@example.com", id: "u_1" },
      extra: { answer: "clinical answer text", requestId: "req-1" },
      contexts: { clinical: { prompt: "system prompt", model: "gpt-5.5" } },
    });

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra?.answer).toBe("[redacted]");
    expect(scrubbed.extra?.requestId).toBe("req-1");
    expect((scrubbed.contexts?.clinical as Record<string, unknown>).prompt).toBe("[redacted]");
    expect((scrubbed.contexts?.clinical as Record<string, unknown>).model).toBe("gpt-5.5");
  });

  it("truncates long exception values so an echoed query cannot arrive verbatim", () => {
    const long = "x".repeat(1000);
    const scrubbed = scrubSentryEvent({ exception: { values: [{ type: "Error", value: long }] } });
    const value = scrubbed.exception?.values?.[0].value ?? "";
    expect(value.length).toBeLessThan(long.length);
    expect(value.endsWith("…[truncated]")).toBe(true);
  });
});

describe("captureClientException — inert until a client is registered", () => {
  afterEach(() => {
    // Reset the module-level client so tests don't leak into each other.
    registerSentryClient({ captureException: () => "" });
    registerSentryClient(undefined as unknown as { captureException: (e: unknown) => string });
  });

  it("no-ops (does not throw) when no Sentry client is registered", () => {
    expect(() => captureClientException(new Error("boom"))).not.toThrow();
  });

  it("forwards to the registered client when Sentry is initialized", () => {
    const captureException = vi.fn(() => "event-id");
    registerSentryClient({ captureException });
    const error = new Error("boom");

    captureClientException(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});

describe("/api/monitoring tunnel — gated + relay-safe", () => {
  const ORIGINAL_DSN = process.env.SENTRY_DSN;

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = ORIGINAL_DSN;
    vi.unstubAllGlobals();
  });

  async function loadRoute() {
    return import("@/app/api/monitoring/route");
  }

  function envelope(dsn: string) {
    return `${JSON.stringify({ dsn })}\n${JSON.stringify({ type: "event" })}\n{}`;
  }

  it("returns 404 when no DSN is configured (inert)", async () => {
    delete process.env.SENTRY_DSN;
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("https://app.example/api/monitoring", {
        method: "POST",
        body: envelope("https://k@o1.ingest.sentry.io/42"),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects an envelope addressed to a different project (no open relay)", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.sentry.io/42";
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("https://app.example/api/monitoring", {
        method: "POST",
        body: envelope("https://key@evil.ingest.sentry.io/999"),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("forwards a matching envelope to the configured Sentry ingest host", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.sentry.io/42";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await loadRoute();

    const res = await POST(
      new Request("https://app.example/api/monitoring", {
        method: "POST",
        body: envelope("https://key@o1.ingest.sentry.io/42"),
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://o1.ingest.sentry.io/api/42/envelope/",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
