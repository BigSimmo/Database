import { describe, expect, it } from "vitest";

import {
  classifyRagFallbackReason,
  isRagFallbackReasonCode,
  publicFallbackReason,
} from "@/lib/rag/rag-fallback-reason";
import { finalizeRagAnswerQuality } from "@/lib/rag/rag-extractive-answer";
import type { RagAnswer, RagFallbackReasonCode, SearchResult } from "@/lib/types";

describe("sanitized RAG fallback reasons", () => {
  it("accepts only canonical non-null runtime codes", () => {
    expect(isRagFallbackReasonCode("provider_timeout")).toBe(true);
    expect(isRagFallbackReasonCode(null)).toBe(false);
    expect(isRagFallbackReasonCode("provider_future_mode")).toBe(false);
  });

  it.each(["provider_timeout", "provider_quota", "provider_failure"] as const)(
    "preserves the typed %s code through extractive recovery labelling",
    (fallbackReasonCode) => {
      const source: SearchResult = {
        id: "chunk-1",
        document_id: "doc-1",
        title: "Clinical monitoring guideline",
        file_name: "monitoring.pdf",
        page_number: 1,
        chunk_index: 0,
        section_heading: "Monitoring",
        content: "Monitor renal function every three months.",
        image_ids: [],
        images: [],
        similarity: 0.95,
      };
      const answer: RagAnswer = {
        answer: "Monitor renal function every three months.",
        grounded: true,
        confidence: "high",
        citations: [
          {
            chunk_id: source.id,
            document_id: source.document_id,
            title: source.title,
            file_name: source.file_name,
            page_number: source.page_number,
            chunk_index: source.chunk_index,
          },
        ],
        sources: [source],
        routingMode: "extractive",
        routingReason: `generation_fallback:${fallbackReasonCode}; source_backed_extractive_fallback`,
        fallbackReasonCode,
        answerQualityTier: "source_only",
        preformatted: true,
      };

      expect(
        finalizeRagAnswerQuality(answer, "What renal monitoring is required?", "document_lookup", [source]),
      ).toHaveProperty("fallbackReasonCode", fallbackReasonCode);
    },
  );

  it("lets a shared stronger governance code supersede a typed provider recovery code", () => {
    const answer = {
      answer: "The source set cannot safely support this claim.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
      routingMode: "unsupported",
      routingReason: "generation_fallback:provider_timeout; post_generation_claim_quality_gate",
      fallbackReasonCode: "provider_timeout",
      answerQualityTier: "source_only",
      preformatted: true,
    } satisfies RagAnswer;

    const result = finalizeRagAnswerQuality(answer, "What monitoring is required?", "document_lookup");
    expect(result.fallbackReasonCode satisfies RagFallbackReasonCode | null | undefined).toBe("citation_or_claim_gate");
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
      [{ routingReason: "source_only_auth_failed" }, "provider_auth"],
      [{ routingReason: "source_only_provider_failed" }, "provider_failure"],
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
      [{ routingReason: "no_retrieved_sources" }, "no_candidates"],
      [{ routingReason: "confidence_gate_blocked; low_signal" }, "low_signal"],
      [{ routingReason: "source_only_offline_mode; comparison_evidence_gap" }, "coverage_gap"],
      [
        { routingReason: "generation_fallback:provider_timeout; post_generation_claim_quality_gate" },
        "citation_or_claim_gate",
      ],
      [{ routingReason: "adversarial_manipulation_refused" }, "source_governance_block"],
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
