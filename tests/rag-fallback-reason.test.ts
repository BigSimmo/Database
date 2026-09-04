import { describe, expect, it } from "vitest";

import {
  classifyRagFallbackReason,
  isRagFallbackReasonCode,
  publicFallbackReason,
} from "@/lib/rag/rag-fallback-reason";

describe("sanitized RAG fallback reasons", () => {
  it("accepts only canonical non-null runtime codes", () => {
    expect(isRagFallbackReasonCode("provider_timeout")).toBe(true);
    expect(isRagFallbackReasonCode(null)).toBe(false);
    expect(isRagFallbackReasonCode("provider_future_mode")).toBe(false);
  });

  it("maps provider failures to stable public codes without internals", () => {
    expect(classifyRagFallbackReason({ providerFailure: "timeout" })).toBe("provider_timeout");
    expect(
      classifyRagFallbackReason({
        routingReason: "hybrid_error; generation_fallback:socket ETIMEDOUT secret-host?token=abc",
      }),
    ).toBe("provider_timeout");
    expect(publicFallbackReason("provider_failure")).not.toMatch(/socket|host|secret|token|provider/i);
  });

  it("gives typed fields precedence over incompatible legacy text", () => {
    expect(
      classifyRagFallbackReason({
        fallbackReasonCode: "source_conflict",
        providerFailure: "timeout",
        routingReason: "missing_api_key",
      }),
    ).toBe("source_conflict");
    expect(
      classifyRagFallbackReason({
        insufficiencyReason: "site_content_stale",
        routingReason: "quota exceeded",
      }),
    ).toBe("site_content_stale");
  });

  it("maps malformed or future runtime typed values to unknown without consulting legacy text", () => {
    expect(
      classifyRagFallbackReason({
        fallbackReasonCode: "provider_timeout\nprivate-host?token=secret" as never,
        providerFailure: "timeout",
        routingReason: "provider_timeout",
      }),
    ).toBe("unknown");
    expect(
      classifyRagFallbackReason({
        fallbackReasonCode: { future: "provider_timeout" } as never,
        routingReason: "provider_timeout",
      }),
    ).toBe("unknown");
  });

  it("maps unknown legacy details to unknown rather than copying sensitive text", () => {
    const secret = "https://private-host.example/path?api_key=secret";
    const code = classifyRagFallbackReason({ routingReason: secret });

    expect(code).toBe("unknown");
    expect(publicFallbackReason(code)).not.toMatch(/private-host|api_key|secret|https/i);
  });

  it("classifies the complete bounded taxonomy and gives specific legacy tokens precedence", () => {
    const cases = [
      [{ routingReason: "source_only_offline_mode" }, "provider_offline"],
      [{ routingReason: "source_only_no_api" }, "provider_missing_key"],
      [{ providerFailure: "auth_failed" }, "provider_auth"],
      [{ routingReason: "generation_fallback:provider_auth_failed" }, "provider_auth"],
      [{ providerFailure: "quota_exhausted" }, "provider_quota"],
      [{ routingReason: "generation_fallback:provider_quota_exhausted" }, "provider_quota"],
      [{ providerFailure: "rate_limited" }, "provider_rate_limit"],
      [{ routingReason: "generation_fallback:provider_rate_limited" }, "provider_rate_limit"],
      [{ routingReason: "generation_fallback:provider_timeout" }, "provider_timeout"],
      [{ routingReason: "generation_fallback:provider_generation_failed" }, "provider_failure"],
      [{ routingReason: "limited_retrieval; vector_fallback" }, "retrieval_degraded"],
      [{ routingReason: "retrieval_miss; no_candidates" }, "no_candidates"],
      [{ routingReason: "confidence_gate_blocked; low_signal" }, "low_signal"],
      [{ insufficiencyReason: "not_in_corpus" }, "coverage_gap"],
      [{ insufficiencyReason: "source_role_mismatch" }, "source_role_mismatch"],
      [{ insufficiencyReason: "source_conflict" }, "source_conflict"],
      [{ insufficiencyReason: "governance_block" }, "source_governance_block"],
      [{ routingReason: "claim_support_high_risk_gap" }, "citation_or_claim_gate"],
      [{ routingReason: "unsupported" }, "unsupported"],
      [{ routingReason: "unrecognized internal detail" }, "unknown"],
    ] as const;

    for (const [input, expected] of cases) {
      expect(classifyRagFallbackReason(input), JSON.stringify(input)).toBe(expected);
    }
  });
});
