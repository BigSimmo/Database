import { afterEach, describe, expect, it, vi } from "vitest";

describe("Sentry agent monitoring gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("stays disabled without a DSN, with tracing off, or without an initialized Sentry client", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.1");
    const noDsn = await import("@/lib/observability/agent-monitoring");
    expect(noDsn.isSentryAgentMonitoringEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/1");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0");
    const rateZero = await import("@/lib/observability/agent-monitoring");
    expect(rateZero.isSentryAgentMonitoringEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/1");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.1");
    const noClient = await import("@/lib/observability/agent-monitoring");
    // Sentry.init never runs in Vitest (or in the ingestion worker), so the
    // client gate keeps agent monitoring off even with DSN + tracing set.
    expect(noClient.isSentryAgentMonitoringEnabled()).toBe(false);
  });

  it("returns the client unwrapped and keeps scope calls inert when disabled", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { instrumentOpenAIClientForAgentMonitoring, setAgentConversationId } =
      await import("@/lib/observability/agent-monitoring");

    const client = { responses: { create: async () => ({}) } };
    expect(instrumentOpenAIClientForAgentMonitoring(client)).toBe(client);
    expect(() => setAgentConversationId("11111111-2222-4333-8444-555555555555")).not.toThrow();
  });
});
