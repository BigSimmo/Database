import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubClientSentryEvent, scrubSentryEvent, scrubSentryTransaction } from "@/lib/observability/sentry-scrub";
import { captureClientException, registerSentryClient } from "@/lib/observability/sentry-client";

describe("scrubSentryEvent — clinical PII contract", () => {
  it("drops request (url/headers/query), breadcrumbs and user; keeps the error", () => {
    const event = {
      message: "boom",
      exception: { values: [{ type: "Error", value: "boom" }] },
      request: { url: "https://app.example/differentials?q=patient+with+chest+pain", headers: { cookie: "s=1" } },
      breadcrumbs: [{ message: "GET /api/answer?query=patient" }],
      user: { email: "patient@example.com", ip_address: "1.2.3.4" },
      transaction: "/documents/search?q=lithium",
    };

    const scrubbed = scrubClientSentryEvent(event);

    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.transaction).toBe("/documents/search");
    // The error itself is preserved for debugging.
    expect(scrubbed.exception?.values?.[0].value).toBe("boom");
  });

  it("scrubSentryTransaction applies the same privacy boundary", () => {
    const event = scrubSentryTransaction({
      transaction: "/api/answer?q=secret",
      request: { url: "https://app.example/api/answer?q=secret" },
      breadcrumbs: [{ message: "console" }],
      user: { id: "u1" },
    });
    expect(event).not.toBeNull();
    expect(event?.request).toBeUndefined();
    expect(event?.breadcrumbs).toBeUndefined();
    expect(event?.user).toBeUndefined();
    expect(event?.transaction).toBe("/api/answer");
  });

  it("scrubSentryEvent is identity-preserving for already-clean events", () => {
    const event = { message: "clean", transaction: "/ok" };
    expect(scrubSentryEvent(event).message).toBe("clean");
    expect(scrubSentryEvent(event).transaction).toBe("/ok");
  });
});

describe("captureClientException — inert until a client is registered", () => {
  afterEach(() => {
    registerSentryClient(null);
  });

  it("no-ops (does not throw) when no Sentry client is registered", () => {
    registerSentryClient(null);
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
