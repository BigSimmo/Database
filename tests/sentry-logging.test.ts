import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSentryLoggingEnabled,
  isSentryTestLogEnabled,
  mapAppLogMessage,
  privacySafeLog,
  privacySafeLogAttributes,
  resolveSentryLogEmission,
  SENTRY_LOG_MESSAGES,
  sentryLog,
} from "@/lib/observability/sentry-logging";

describe("isSentryLoggingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a DSN and defaults on when the flag is unset", () => {
    // Offline Vitest forces SENTRY_ENABLE_LOGS=false and pins an inert
    // SENTRY_DSN so Next cannot reload a live destination. Defaults apply when
    // the argument is omitted *or* explicitly undefined, so stub both ambient
    // names: empty flag (default-on path) and empty DSN (first assertion).
    // Passing "" positionally instead would only test the explicit-empty path.
    vi.stubEnv("SENTRY_ENABLE_LOGS", "");
    vi.stubEnv("SENTRY_DSN", "");
    expect(isSentryLoggingEnabled(undefined, undefined)).toBe(false);
    expect(isSentryLoggingEnabled(undefined, "https://example.ingest.sentry.io/1")).toBe(true);
    expect(isSentryLoggingEnabled("false", "https://example.ingest.sentry.io/1")).toBe(false);
    expect(isSentryLoggingEnabled("0", "https://example.ingest.sentry.io/1")).toBe(false);
    expect(isSentryLoggingEnabled("true", "https://example.ingest.sentry.io/1")).toBe(true);
  });
});

describe("privacySafeLogAttributes", () => {
  it("keeps operational fields and drops clinical/PII-shaped values", () => {
    const attrs = privacySafeLogAttributes({
      bucket: "answer",
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 30,
      requestId: "req-123",
      query: "patient with suicidal ideation",
      email: "jane@example.test",
      ownerId: "owner-uuid",
      message: "something long that should not pass because the key is not allowlisted",
    });

    expect(attrs).toEqual({
      bucket: "answer",
      code: "rate_limited",
      status: 429,
      retry_after_seconds: 30,
      request_id: "req-123",
    });
    expect(JSON.stringify(attrs)).not.toMatch(/patient|suicid|jane|owner-uuid/i);
  });

  it("drops free text on an allowlisted key when it names a clinical subject in any word form", () => {
    // The stems once sat inside `\b...\b`, so "suicid" matched neither
    // "suicide" nor "suicidal", and "patient" missed "patients".
    for (const failure of [
      "suicidal ideation noted",
      "after a suicide attempt",
      "two patients waiting",
      "queries about lithium",
      "long answers returned",
      "prompts were rejected",
    ]) {
      expect(privacySafeLogAttributes({ failure })).toEqual({});
    }
    // A lone clinical word used to pass as an "operational token".
    for (const failure of ["suicidal", "Suicide", "patients", "MRN"]) {
      expect(privacySafeLogAttributes({ failure })).toEqual({});
    }
    // Operational labels that happen to be ordinary words still pass.
    expect(privacySafeLogAttributes({ bucket: "answer", route_type: "query" })).toEqual({
      bucket: "answer",
      route_type: "query",
    });
    expect(privacySafeLogAttributes({ failure: "upstream timeout after retry" })).toEqual({
      failure: "upstream timeout after retry",
    });
  });
});

describe("privacySafeLog", () => {
  it("drops debug/trace and unknown messages", () => {
    expect(
      privacySafeLog({
        level: "debug",
        message: SENTRY_LOG_MESSAGES.API_REQUEST_FAILED,
        attributes: { status: 500 },
      }),
    ).toBeNull();

    expect(
      privacySafeLog({
        level: "warn",
        message: "User Jane searched for lithium toxicity with MRN 123456",
        attributes: { status: 429 },
      }),
    ).toBeNull();
  });

  it("keeps allowlisted warn/error wide events", () => {
    const scrubbed = privacySafeLog({
      level: "warn",
      message: SENTRY_LOG_MESSAGES.API_RATE_LIMITED,
      attributes: {
        bucket: "answer",
        code: "rate_limited",
        status: 429,
        query: "clinical free text must not export",
      },
    });

    expect(scrubbed).toEqual({
      level: "warn",
      message: "API rate limited",
      attributes: {
        bucket: "answer",
        code: "rate_limited",
        status: 429,
      },
    });
  });
});

describe("resolveSentryLogEmission / logger bridge mapping", () => {
  it("maps unknown app logger messages to generic allowlisted labels", () => {
    expect(mapAppLogMessage("warn", "totally unknown free-form message")).toBe("Application warn");
    expect(mapAppLogMessage("error", "totally unknown free-form message")).toBe("Application error");
    expect(mapAppLogMessage("error", SENTRY_LOG_MESSAGES.API_REQUEST_FAILED)).toBe("API request failed");
  });

  it("builds wide-event payloads without clinical attributes", () => {
    expect(
      resolveSentryLogEmission(SENTRY_LOG_MESSAGES.API_RATE_LIMITED, {
        bucket: "answer",
        code: "rate_limited",
        retry_after_seconds: 12,
        query: "do not export",
      }),
    ).toEqual({
      message: "API rate limited",
      attributes: {
        bucket: "answer",
        code: "rate_limited",
        retry_after_seconds: 12,
      },
    });
  });

  it("stays inert without a DSN even if callers invoke sentryLog", () => {
    vi.stubEnv("SENTRY_DSN", "");
    expect(() => sentryLog.warn(SENTRY_LOG_MESSAGES.API_RATE_LIMITED, { bucket: "answer" })).not.toThrow();
    vi.unstubAllEnvs();
  });

  it("allowlists the Sentry Logs wizard verify sample", () => {
    expect(isSentryTestLogEnabled(undefined)).toBe(false);
    expect(isSentryTestLogEnabled("true")).toBe(true);
    expect(resolveSentryLogEmission(SENTRY_LOG_MESSAGES.SENTRY_TEST, { log_source: "sentry_test" })).toEqual({
      message: "User triggered test log",
      attributes: { log_source: "sentry_test" },
    });
  });
});
