import { afterEach, describe, expect, it, vi } from "vitest";

// The capture helper (src/lib/observability/error-capture.ts) must be fully inert
// without SENTRY_DSN — no SDK import, no calls — and must never let a capture
// failure propagate into the request path. env is parsed at import time, so each
// case re-imports the module with a fresh, stubbed environment.

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@sentry/node", () => sentryMocks);

const TEST_DSN = "https://publickey@o0.ingest.sentry.io/0";

async function loadCapture(dsn: string | undefined) {
  vi.resetModules();
  vi.stubEnv("SENTRY_DSN", dsn);
  return import("../src/lib/observability/error-capture");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("captureServerException", () => {
  it("is a no-op without a DSN", async () => {
    const { captureServerException } = await loadCapture(undefined);
    await expect(captureServerException(new Error("boom"), { route: "api/answer" })).resolves.toBeUndefined();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("treats a blank DSN as disabled", async () => {
    const { captureServerException } = await loadCapture(" ");
    await captureServerException(new Error("boom"));
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("redacts the error and forwards only operational context when a DSN is set", async () => {
    const { captureServerException } = await loadCapture(TEST_DSN);
    const error = new Error("boom");
    await captureServerException(error, { route: "api/answer", status: 500 });

    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    const [captured, hint] = sentryMocks.captureException.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured).not.toBe(error);
    expect(captured.message).toBe("Server request failed");
    expect(captured.stack).not.toContain("boom");
    expect(hint).toEqual({ extra: { route: "api/answer", status: 500 } });
  });

  it("does not forward a mutable error name", async () => {
    const { captureServerException } = await loadCapture(TEST_DSN);
    const error = new Error("private message");
    error.name = "lithium query from document 123";
    await captureServerException(error, { route: "api/answer" });

    const [, hint] = sentryMocks.captureException.mock.calls[0];
    expect(JSON.stringify(hint)).not.toContain(error.name);
  });

  it("never propagates a failure inside the SDK", async () => {
    const { captureServerException } = await loadCapture(TEST_DSN);
    sentryMocks.captureException.mockImplementationOnce(() => {
      throw new Error("sdk exploded");
    });
    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();
  });
});

describe("captureServerEvent", () => {
  it("is a no-op without a DSN", async () => {
    const { captureServerEvent } = await loadCapture(undefined);
    await expect(captureServerEvent("answer_generation_fallback")).resolves.toBeUndefined();
    expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
  });

  it("reports a warning-level message with context when a DSN is set", async () => {
    const { captureServerEvent } = await loadCapture(TEST_DSN);
    await captureServerEvent("answer_generation_fallback", { reason: "max_output_tokens", queryClass: "dose" });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, options] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toBe("answer_generation_fallback");
    expect(options.level).toBe("warning");
    expect(options.extra).toEqual({ reason: "max_output_tokens", queryClass: "dose" });
  });
});
