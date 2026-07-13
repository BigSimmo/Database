import { describe, expect, it } from "vitest";

import {
  answerDegradedModeSignal,
  buildGovernedAnswerClientResponse,
  buildGovernedDemoAnswerClientResponse,
} from "../src/lib/answer-response";
import type { RagAnswer, SearchResult } from "../src/lib/types";

function source(documentStatus: "current" | "outdated" = "current"): SearchResult {
  return {
    id: "chunk-1",
    document_id: "document-1",
    title: "Clinical guideline",
    file_name: "clinical-guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Use the current monitoring pathway.",
    image_ids: [],
    images: [],
    similarity: 0.9,
    source_metadata: {
      source_title: "Clinical guideline",
      publisher: "WA Health",
      publisher_code: "WA_HEALTH",
      jurisdiction: "Australia/WA",
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: documentStatus,
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
  };
}

function answer(overrides: Partial<RagAnswer> = {}): RagAnswer {
  return {
    answer: "Use the cited monitoring pathway.",
    grounded: true,
    confidence: "high",
    citations: [
      {
        chunk_id: "chunk-1",
        document_id: "document-1",
        title: "Clinical guideline",
        file_name: "clinical-guideline.pdf",
        page_number: 1,
        chunk_index: 0,
      },
    ],
    sources: [source()],
    ...overrides,
  };
}

describe("governed answer response", () => {
  it("keeps a normal grounded answer and derives source-only degradation consistently", () => {
    const result = buildGovernedAnswerClientResponse(
      answer({ answerQualityTier: "source_only", fallbackReason: "generation_fallback" }),
    );

    expect(result.refused).toBe(false);
    expect(result.payload).toMatchObject({
      answer: "Use the cited monitoring pathway.",
      degradedMode: { active: true, reason: "generation_fallback" },
    });
    expect(answerDegradedModeSignal()).toEqual({ active: false, reason: null });
  });

  it("fails closed without leaking answer-only fields when any answer route sees danger governance", () => {
    const result = buildGovernedAnswerClientResponse(
      answer({
        sources: [source("outdated")],
        smartPanel: { query: "monitoring" } as RagAnswer["smartPanel"],
        smartApiPlan: { displayMode: "direct" } as unknown as RagAnswer["smartApiPlan"],
      }),
    );

    expect(result.refused).toBe(true);
    expect(result.payload).toMatchObject({ grounded: false, confidence: "unsupported", citations: [], sources: [] });
    expect(result.payload).not.toHaveProperty("smartPanel");
    expect(result.payload).not.toHaveProperty("smartApiPlan");
    expect(result.telemetryAnswer.routingReason).toContain("source_governance_refusal");
  });

  it("applies the same governed and degraded contract to demo answers", () => {
    const result = buildGovernedDemoAnswerClientResponse(
      answer({
        sources: [source("outdated")],
        smartPanel: { query: "monitoring" } as RagAnswer["smartPanel"],
      }),
      "supabase_api_key_configuration",
    );

    expect(result).toMatchObject({
      demoMode: true,
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
      degradedMode: { active: true, reason: "supabase_api_key_configuration" },
      fallbackMode: "non_production_demo",
      fallbackReason: "supabase_api_key_configuration",
    });
    expect(result).not.toHaveProperty("smartPanel");
  });
});
