import { describe, expect, it } from "vitest";

import { fallbackReasonFromRouting, isProviderGenerationDegraded } from "@/lib/rag/rag-answer-support";

describe("provider generation degradation classification", () => {
  it("counts generation fallbacks but excludes intentional extractive and unsupported routes", () => {
    expect(isProviderGenerationDegraded("strong_generation; generation_fallback:provider_timeout")).toBe(true);
    expect(isProviderGenerationDegraded("high_confidence_extractive_retrieval")).toBe(false);
    expect(isProviderGenerationDegraded("source_support_document_lookup")).toBe(false);
    expect(isProviderGenerationDegraded("confidence_gate_blocked; unsupported")).toBe(false);
  });

  it("uses typed fallback codes first and retains legacy parsing for older cached answers", () => {
    expect(
      isProviderGenerationDegraded({
        fallbackReasonCode: "provider_timeout",
        routingReason: "high_confidence_extractive_retrieval",
      }),
    ).toBe(true);
    expect(isProviderGenerationDegraded({ fallbackReasonCode: "provider_offline" })).toBe(true);
    expect(isProviderGenerationDegraded({ fallbackReasonCode: "provider_missing_key" })).toBe(true);
    expect(
      isProviderGenerationDegraded({
        fallbackReasonCode: "coverage_gap",
        routingReason: "generation_fallback:provider_timeout",
      }),
    ).toBe(false);
    expect(fallbackReasonFromRouting({ routingReason: "generation_fallback:provider_timeout" })).toBe(
      "provider_timeout",
    );
    expect(fallbackReasonFromRouting("clinical_fast_grounded_synthesis")).toBeNull();
  });
});
