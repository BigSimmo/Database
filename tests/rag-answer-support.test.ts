import { describe, expect, it } from "vitest";

import { isProviderGenerationDegraded } from "@/lib/rag/rag-answer-support";

describe("provider generation degradation classification", () => {
  it("counts generation fallbacks but excludes intentional extractive and unsupported routes", () => {
    expect(isProviderGenerationDegraded("strong_generation; generation_fallback:provider_timeout")).toBe(true);
    expect(isProviderGenerationDegraded("high_confidence_extractive_retrieval")).toBe(false);
    expect(isProviderGenerationDegraded("source_support_document_lookup")).toBe(false);
    expect(isProviderGenerationDegraded("confidence_gate_blocked; unsupported")).toBe(false);
  });
});
