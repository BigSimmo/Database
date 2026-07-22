import { describe, expect, it } from "vitest";

import { buildAnswerRenderModel } from "../src/lib/answer-render-policy";
import { buildGovernedAnswerClientResponse } from "../src/lib/answer-response";
import { frontendSourceGovernanceWarnings, sourceGovernanceWarnings } from "../src/lib/source-governance";
import { normalizeSourceMetadata } from "../src/lib/source-metadata";
import type { RagAnswer, SearchResult } from "../src/lib/types";

// Issue 13: a single end-to-end guard that governance provenance survives every hop
// of the pipeline — DB-boundary normalization → governance warnings → governed client
// payload (both source citations AND safety-finding citations) → render policy. Unit
// tests cover each stage in isolation; this proves the joints between them, and is the
// test that would have caught the safety-citation metadata drop (Issue 9).

function buildSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Full blood count weekly for 18 weeks.",
    image_ids: [],
    similarity: 0.42,
    source_metadata: {
      source_title: "Clozapine monitoring guideline",
      publisher: "WA Health",
      jurisdiction: "Australia/WA",
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    indexing_quality: {
      document_id: "doc-1",
      quality_score: 0.9,
      extraction_quality: "good",
      metrics: {},
      issues: [],
    },
    table_facts: [],
    images: [],
    ...overrides,
  };
}

describe("source governance provenance flows end-to-end", () => {
  it("carries warning-level governance metadata from DB normalization through the client payload to the render policy", () => {
    const source = buildSource({
      // Proven safety-deriving content (mirrors answer-client-payload fixture): the
      // useful clinical sentence is a contraindication, so a safety finding is derived.
      content: `${"Routine context. ".repeat(60)}Contraindicated in severe disease.`,
      source_metadata: {
        source_title: "Clozapine monitoring guideline",
        publisher: "WA Health",
        jurisdiction: "Australia/WA",
        version: null,
        publication_date: null,
        review_date: "2020-01-01",
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "review_due",
        clinical_validation_status: "unverified",
        extraction_quality: "good",
      },
    });

    // Hop 1 — DB boundary: raw metadata normalizes to the governance fields.
    const normalized = normalizeSourceMetadata(source.source_metadata);
    expect(normalized.document_status).toBe("review_due");
    expect(normalized.clinical_validation_status).toBe("unverified");

    // Hop 2 — governance: currency + validation caveats are both frontend-visible.
    const warnings = sourceGovernanceWarnings({ results: [source] });
    const visibleCodes = frontendSourceGovernanceWarnings(warnings).map((warning) => warning.code);
    expect(visibleCodes).toEqual(expect.arrayContaining(["review_due_source", "unverified_source"]));

    const answer = {
      answer: "Review the monitoring guidance before prescribing.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [source],
    } as RagAnswer;

    const response = buildGovernedAnswerClientResponse(answer);

    // Warning-level governance does not refuse — the answer (and its provenance) flows through.
    expect(response.refused).toBe(false);

    // Hop 3a — client payload source citations retain provenance.
    expect(response.payload.sources?.[0]?.source_metadata).toMatchObject({
      document_status: "review_due",
      clinical_validation_status: "unverified",
    });

    // Hop 3b — safety-finding citations retain provenance (Issue 9 regression guard).
    expect(response.payload.safetyWarnings?.length ?? 0).toBeGreaterThan(0);
    expect(response.payload.safetyWarnings?.[0]?.citation.source_metadata).toMatchObject({
      document_status: "review_due",
      clinical_validation_status: "unverified",
    });

    // Hop 4 — render policy surfaces the governance message in the render model.
    const renderModel = buildAnswerRenderModel({ ...answer, sourceGovernanceWarnings: warnings } as RagAnswer);
    expect(renderModel.warnings).toEqual(
      expect.arrayContaining(["One or more supporting sources are due for review."]),
    );
  });

  it("fails conservatively (refuses) when a supporting source is outdated, instead of passing stale guidance through", () => {
    const outdatedSource = buildSource({
      document_id: "doc-outdated",
      source_metadata: {
        source_title: "Superseded protocol",
        publisher: "WA Health",
        jurisdiction: "Australia/WA",
        version: null,
        publication_date: null,
        review_date: null,
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "outdated",
        clinical_validation_status: "approved",
        extraction_quality: "good",
      },
    });

    const response = buildGovernedAnswerClientResponse({
      answer: "Outdated guidance.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [outdatedSource],
    } as RagAnswer);

    // An outdated source is a danger-class governance signal: the governed contract
    // refuses and strips sources rather than serving stale clinical guidance.
    expect(response.refused).toBe(true);
    expect(response.payload.sources).toHaveLength(0);
    expect(response.payload.safetyWarnings).toHaveLength(0);
  });
});
