import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/browser";
import { scrubClientSentryEvent } from "@/lib/observability/sentry-scrub";
import { captureClientException, registerSentryClient } from "@/lib/observability/sentry-client";

describe("scrubClientSentryEvent — clinical PII contract", () => {
  it("drops request (url/headers/query), breadcrumbs and user; keeps the error", () => {
    const event = {
      message: "boom",
      exception: { values: [{ type: "Error", value: "boom" }] },
      request: { url: "https://app.example/differentials?q=patient+with+chest+pain", headers: { cookie: "s=1" } },
      breadcrumbs: [{ message: "GET /api/answer?query=patient" }],
      user: { email: "patient@example.com", ip_address: "1.2.3.4" },
    } as unknown as ErrorEvent;

    const scrubbed = scrubClientSentryEvent(event);

    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    // The error itself is preserved for debugging.
    expect(scrubbed.exception?.values?.[0].value).toBe("boom");
  });
});

describe("captureClientException — inert until a client is registered", () => {
  afterEach(() => {
    registerSentryClient(undefined as unknown as { captureException: (e: unknown) => string });
  });

  it("no-ops (does not throw) when no Sentry client is registered", () => {
    registerSentryClient(undefined as unknown as { captureException: (e: unknown) => string });
    expect(() => captureClientException(new Error("boom"))).not.toThrow();
  });

  it("forwards to the registered client when the browser SDK is initialized", () => {
    const captureException = vi.fn(() => "event-id");
    registerSentryClient({ captureException });
    const error = new Error("boom");

    captureClientException(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});

describe("/api/monitoring tunnel — gated, relay-safe, size-capped", () => {
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

  it("rejects an oversized envelope with 413", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.sentry.io/42";
    const { POST } = await loadRoute();
    const oversized = `${JSON.stringify({ dsn: "https://key@o1.ingest.sentry.io/42" })}\n${"x".repeat(1_100_000)}`;
    const res = await POST(new Request("https://app.example/api/monitoring", { method: "POST", body: oversized }));
    expect(res.status).toBe(413);
  });

  it("forwards a matching envelope to the configured Sentry ingest host (with a timeout signal)", async () => {
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
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
