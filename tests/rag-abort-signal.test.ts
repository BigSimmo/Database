import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("RAG abort signal propagation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts searchChunksWithTelemetry before Supabase work starts", async () => {
    const createAdminClient = vi.fn();
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    vi.doMock("@/lib/rag-provider", () => ({
      isSourceOnlyMode: () => true,
      allowsAutoDegrade: () => true,
      sourceOnlyReason: () => "source_only",
      classifyProviderFailure: () => "provider_failure",
    }));

    const controller = new AbortController();
    controller.abort(new DOMException("The operation was aborted.", "AbortError"));
    const { searchChunksWithTelemetry } = await import("../src/lib/rag");

    await expect(
      searchChunksWithTelemetry({
        query: "clozapine monitoring",
        allowGlobalSearch: true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createAdminClient).not.toHaveBeenCalled();
  }, 60_000);
});
