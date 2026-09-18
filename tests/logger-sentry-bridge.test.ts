import { afterEach, describe, expect, it, vi } from "vitest";

import { SENTRY_LOG_MESSAGES, resolveSentryLogEmission } from "@/lib/observability/sentry-logging";
import { catalogueSeedFallbackLogMessage } from "@/lib/site-content/catalogue-seed-fallback";

/**
 * MEASURED 2026-09-18 against the live project, and the reason this file exists. Thirty days of
 * Sentry Logs contained exactly two distinct messages — "API rate limit durable check unavailable"
 * (165) and "API rate limited" (3) — both emitted by direct `sentryLog.*` calls from
 * `api-rate-limit.ts`, which bypass the logger bridge entirely. There were zero "Application
 * error", zero "Application warn" and zero "API request failed", the three messages only the
 * bridge can produce. It had therefore never delivered a single log in production, and nothing in
 * the repository referenced `registerSentryLogForwarder` at all.
 *
 * The cause was that the forwarder lived in a module-local binding. Next bundles
 * `instrumentation.ts` — which loads `sentry.server.config.ts` and performs the one registration —
 * separately from route handlers, so the registration landed on one instance of the logger module
 * and every `logger.error` in a route read another, where it was still null.
 */
// The logger reads process.env directly through a local helper, and short-circuits entirely when
// NODE_ENV is "test", so the environment has to be stubbed rather than the env module mocked.
async function freshLogger(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("LOG_LEVEL", "debug");
  return import("@/lib/logger");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  // The bridge is deliberately global, so it outlives module resets; clear it between cases.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("psychsift.logger.sentryLogForwarder")];
});

describe("the logger's Sentry bridge", () => {
  it("forwards warn and error once instrumentation has registered it", async () => {
    const { logger, registerSentryLogForwarder } = await freshLogger("production");
    const forwarded: Array<[string, string]> = [];
    registerSentryLogForwarder((level, message) => forwarded.push([level, message]));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.error("boom");
    logger.warn("careful");

    expect(forwarded).toEqual([
      ["error", "boom"],
      ["warn", "careful"],
    ]);
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR. Registration happens in one module instance and the log
   * call happens in another, which is exactly what Next's bundling produces in production. A
   * module-local binding passes every other test in this file and fails only here.
   */
  it("survives a second instance of the logger module, as Next's bundling produces", async () => {
    const registrar = await freshLogger("production");
    const forwarded: string[] = [];
    registrar.registerSentryLogForwarder((_level, message) => forwarded.push(message));

    // A different copy of the module, as a route handler's bundle would hold.
    const routeCopy = await freshLogger("production");
    expect(routeCopy.logger).not.toBe(registrar.logger);
    vi.spyOn(console, "error").mockImplementation(() => {});

    routeCopy.logger.error("from the other bundle");

    expect(forwarded).toEqual(["from the other bundle"]);
  });

  it("stays silent when nothing has registered a bridge", async () => {
    const { logger } = await freshLogger("production");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => logger.error("boom")).not.toThrow();
  });

  it("can be deregistered", async () => {
    const { logger, registerSentryLogForwarder } = await freshLogger("production");
    const forwarded: string[] = [];
    registerSentryLogForwarder((_level, message) => forwarded.push(message));
    registerSentryLogForwarder(null);
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("boom");

    expect(forwarded).toEqual([]);
  });
});

describe("the catalogue seed fallback reaches Sentry Logs intact", () => {
  /**
   * The bridge rewrites any message it does not recognise to a bare "Application error". The
   * catalogue fallback's own module insists the fallback "MUST be loud", because a silent
   * degradation of exactly this kind cost seven days in September 2026 — so an unrecognised
   * message defeats the purpose of logging it at all.
   */
  it("is allowlisted, so it is not rewritten to a generic message", () => {
    expect(SENTRY_LOG_MESSAGES.CATALOGUE_SEED_FALLBACK).toBe(catalogueSeedFallbackLogMessage);
    expect(resolveSentryLogEmission(catalogueSeedFallbackLogMessage)).not.toBeNull();
  });

  it("carries which catalogue failed, how, and the budgets it breached", () => {
    const resolved = resolveSentryLogEmission(catalogueSeedFallbackLogMessage, {
      catalogue_kind: "medications",
      failure: "TimeoutError",
      budget_ms: 1200,
      cooldown_ms: 30000,
    });

    expect(resolved?.attributes).toEqual({
      catalogue_kind: "medications",
      failure: "TimeoutError",
      budget_ms: 1200,
      cooldown_ms: 30000,
    });
  });

  /**
   * `detail` is `error.message`, which for a Postgres failure is free-form provider text. It is
   * deliberately not allowlisted: knowing the catalogue and the error type is enough to choose the
   * next step, and exporting raw database text from a clinical system is not worth the convenience.
   */
  it("does not export the raw error message", () => {
    const resolved = resolveSentryLogEmission(catalogueSeedFallbackLogMessage, {
      catalogue_kind: "forms",
      detail: 'relation "site_content_publications" does not exist',
    });

    expect(resolved?.attributes).toEqual({ catalogue_kind: "forms" });
    expect(JSON.stringify(resolved)).not.toContain("site_content_publications");
  });
});
