import { describe, expect, it } from "vitest";
import {
  buildRagQueryMetadata,
  buildRagProgrammeTelemetry,
  carryRagProgrammeTelemetry,
  observeRagAnswer,
  ragProgrammeTelemetryForAnswer,
  type RagProgrammeTelemetryInput,
} from "../src/lib/rag/rag-programme-telemetry";
import { cloneAnswer, withRagAnswerQueryPlanDiagnostics } from "../src/lib/rag/rag-cache";
import { toClientAnswerPayload } from "../src/lib/answer-client-payload";
import { buildAnswerLogRow } from "../src/lib/answer-telemetry";
import { buildGovernedAnswerClientResponse } from "../src/lib/answer-response";
import type { RagAnswer, SearchResult } from "../src/lib/types";

const INTERACTION_ID = "11111111-1111-4111-8111-111111111111";

function input(overrides: Partial<RagProgrammeTelemetryInput> = {}): RagProgrammeTelemetryInput {
  return {
    interactionId: INTERACTION_ID,
    rolloutMode: "legacy",
    queryPlanKind: "single",
    subquestionCount: 1,
    materialAmbiguity: false,
    coverageCounts: { direct: 1, partial: 0, conflicting: 0, absent: 0 },
    candidateMatchCounts: null,
    candidateCounts: {
      uploaded_local: 2,
      clinical_kb_site: 0,
      australian_public: 0,
      international_supplementary: 0,
    },
    selectedCounts: {
      uploaded_local: 1,
      clinical_kb_site: 0,
      australian_public: 0,
      international_supplementary: 0,
    },
    selectedSiteDomains: [],
    siteCandidateCount: 0,
    siteSelectedCount: 0,
    publicSiteContentState: "disabled",
    siteStaticManifestMatch: null,
    sitePendingCountBucket: null,
    augmentationOutcome: "disabled",
    roleExclusionCount: 0,
    insufficiencyReason: null,
    generationOutcome: "generated",
    verifiedUnitsEmitted: 0,
    verifiedUnitsDiscarded: 0,
    reconciliationOutcome: "not_applicable",
    ...overrides,
  };
}

describe("RAG programme telemetry projection", () => {
  it("projects only allow-listed counts, enums, booleans, and the opaque interaction id", () => {
    const contaminated = {
      ...input(),
      rawQuery: "patient-name-canary",
      subquestions: ["subquestion-text-canary"],
      providerError: "provider-error-canary",
      ownerId: "owner-id-canary",
    } as RagProgrammeTelemetryInput & Record<string, unknown>;

    const projected = buildRagProgrammeTelemetry(contaminated);

    expect(projected.interaction_id).toBe(INTERACTION_ID);
    expect(Object.keys(projected)).toEqual([
      "version",
      "interaction_id",
      "rollout_mode",
      "query_plan_kind",
      "subquestion_count",
      "material_ambiguity",
      "coverage_counts",
      "candidate_match_counts",
      "candidate_counts",
      "selected_counts",
      "selected_site_domains",
      "site_candidate_count",
      "site_selected_count",
      "public_site_content_state",
      "site_static_manifest_match",
      "site_pending_count_bucket",
      "augmentation_outcome",
      "role_exclusion_count",
      "insufficiency_reason",
      "fallback_reason_code",
      "generation_outcome",
      "verified_units_emitted",
      "verified_units_discarded",
      "reconciliation_outcome",
    ]);
    expect(JSON.stringify(projected)).not.toContain("patient-name-canary");
    expect(JSON.stringify(projected)).not.toContain("subquestion-text-canary");
    expect(JSON.stringify(projected)).not.toContain("provider-error-canary");
    expect(JSON.stringify(projected)).not.toContain("owner-id-canary");
    expect(projected.candidate_match_counts).toBeNull();
  });

  it("validates the aggregate and every nested insufficiency reason", () => {
    expect(() =>
      buildRagProgrammeTelemetry(
        input({ nestedInsufficiencyReasons: ["retrieval_miss", "provider-error-canary" as never] }),
      ),
    ).toThrow("nestedInsufficiencyReasons[1]");
    expect(() => buildRagProgrammeTelemetry(input({ insufficiencyReason: "provider-error-canary" as never }))).toThrow(
      "insufficiencyReason",
    );
  });

  it("rejects candidate-match counters that are unbounded or do not total the subquestion count", () => {
    expect(() =>
      buildRagProgrammeTelemetry(
        input({ subquestionCount: 4, candidateMatchCounts: { matched: 1, partial_match: 0, absent: 1 } }),
      ),
    ).toThrow("candidateMatchCounts");
    expect(() =>
      buildRagProgrammeTelemetry(
        input({ subquestionCount: 5, candidateMatchCounts: { matched: 5, partial_match: 0, absent: 0 } }),
      ),
    ).toThrow("candidateMatchCounts");
  });

  it("keeps the required join flag-independent while gating diagnostic detail", () => {
    const projected = buildRagProgrammeTelemetry(input());
    expect(buildRagQueryMetadata(projected, false)).toEqual({ interaction_id: INTERACTION_ID });
    const retrievalRow = buildAnswerLogRow({
      query: "fixture question",
      interactionId: INTERACTION_ID,
      programmeTelemetry: projected,
      answer: {
        grounded: true,
        confidence: "high",
        sources: [],
      },
    });
    expect((retrievalRow.metadata as { answer: { interaction_id: string } }).answer.interaction_id).toBe(
      INTERACTION_ID,
    );
    expect(buildRagQueryMetadata(projected, true)).toEqual({
      interaction_id: INTERACTION_ID,
      rag_programme: projected,
    });
  });

  it("keeps programme diagnostics and contaminated source text outside the browser payload", () => {
    const answer = observeRagAnswer(
      {
        answer: "Governed answer.",
        grounded: true,
        confidence: "high",
        citations: [],
        sources: [],
        routingMode: "strong",
        modelUsed: "gpt-5.6",
      } satisfies RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );
    const telemetry = ragProgrammeTelemetryForAnswer(answer);
    expect(telemetry?.interaction_id).toBe(INTERACTION_ID);
    expect(JSON.stringify(toClientAnswerPayload(answer))).not.toContain("rag-programme-telemetry-v1");
    expect(JSON.stringify(toClientAnswerPayload(answer))).not.toContain(INTERACTION_ID);
  });

  it.each(["provider_offline", "provider_missing_key"] as const)(
    "classifies typed-only %s as a source-only generation outcome",
    (fallbackReasonCode) => {
      const answer = observeRagAnswer(
        {
          answer: "Deterministic source-backed fallback.",
          grounded: true,
          confidence: "medium",
          citations: [],
          sources: [],
          routingMode: "extractive",
          fallbackReasonCode,
        } satisfies RagAnswer,
        { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
      );

      expect(ragProgrammeTelemetryForAnswer(answer)).toMatchObject({
        fallback_reason_code: fallbackReasonCode,
        insufficiency_reason: "provider_failure",
        generation_outcome: "source_only",
      });
    },
  );

  it("rebinds a cached or coalesced answer object to the current route-created interaction id", () => {
    const reusedAnswer = {
      answer: "Cached governed answer.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
      routingMode: "extractive",
      routingReason: "answer_cache_hit",
    } satisfies RagAnswer;
    const first = observeRagAnswer(reusedAnswer, {
      interactionId: INTERACTION_ID,
      rolloutMode: "legacy",
    });
    expect(ragProgrammeTelemetryForAnswer(first)?.interaction_id).toBe(INTERACTION_ID);

    const secondId = "22222222-2222-4222-8222-222222222222";
    const second = observeRagAnswer(reusedAnswer, {
      interactionId: secondId,
      rolloutMode: "legacy",
    });

    expect(second).toBe(first);
    expect(ragProgrammeTelemetryForAnswer(second)?.interaction_id).toBe(secondId);
    expect(JSON.stringify(second)).not.toContain(INTERACTION_ID);
    expect(JSON.stringify(second)).not.toContain(secondId);
  });

  it("preserves bounded decomposed shadow facts across answer clones and telemetry carry", () => {
    const planned = withRagAnswerQueryPlanDiagnostics(
      {
        answer: "Shadow-planned governed answer.",
        grounded: true,
        confidence: "high",
        citations: [],
        sources: [],
        routingMode: "extractive",
      } satisfies RagAnswer,
      {
        ragQueryPlanKind: "decomposed",
        ragSubquestionCount: 3,
        ragCandidateMatchCounts: { matched: 1, partial_match: 1, absent: 1 },
      },
    );
    const observed = observeRagAnswer(planned, {
      interactionId: INTERACTION_ID,
      rolloutMode: "shadow",
    });
    const cachedOrCoalesced = observeRagAnswer(cloneAnswer(observed), {
      interactionId: "22222222-2222-4222-8222-222222222222",
      rolloutMode: "shadow",
    });
    const governedCopy = carryRagProgrammeTelemetry(cachedOrCoalesced, {
      ...cachedOrCoalesced,
      answer: "Governed copy.",
    });

    expect(ragProgrammeTelemetryForAnswer(observed)).toMatchObject({
      rollout_mode: "shadow",
      query_plan_kind: "decomposed",
      subquestion_count: 3,
      candidate_match_counts: { matched: 1, partial_match: 1, absent: 1 },
      coverage_counts: { direct: 1, partial: 0, conflicting: 0, absent: 0 },
    });
    expect(ragProgrammeTelemetryForAnswer(cachedOrCoalesced)).toMatchObject({
      query_plan_kind: "decomposed",
      subquestion_count: 3,
    });
    expect(ragProgrammeTelemetryForAnswer(governedCopy)).toMatchObject({
      query_plan_kind: "decomposed",
      subquestion_count: 3,
      candidate_match_counts: { matched: 1, partial_match: 1, absent: 1 },
      coverage_counts: { direct: 1, partial: 0, conflicting: 0, absent: 0 },
    });
    expect(JSON.stringify(ragProgrammeTelemetryForAnswer(governedCopy))).not.toContain("Shadow-planned");
  });

  it("marks a clarification-required query plan as materially ambiguous", () => {
    const answer = withRagAnswerQueryPlanDiagnostics(
      {
        answer: "Clarification required.",
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
      } satisfies RagAnswer,
      {
        ragQueryPlanKind: "clarification_required",
        ragSubquestionCount: 0,
      },
    );

    observeRagAnswer(answer, { interactionId: INTERACTION_ID, rolloutMode: "shadow" });

    expect(ragProgrammeTelemetryForAnswer(answer)).toMatchObject({
      query_plan_kind: "clarification_required",
      subquestion_count: 0,
      material_ambiguity: true,
      candidate_match_counts: null,
    });
  });

  it("keeps source conflict separate from query ambiguity", () => {
    const answer = withRagAnswerQueryPlanDiagnostics(
      {
        answer: "Sources disagree.",
        grounded: true,
        confidence: "medium",
        citations: [],
        sources: [],
        conflictsOrGaps: [
          {
            type: "conflict",
            message: "Intervals differ.",
            source_chunk_ids: ["source-a", "source-b"],
          },
        ],
      } satisfies RagAnswer,
      {
        ragQueryPlanKind: "single",
        ragSubquestionCount: 1,
      },
    );

    observeRagAnswer(answer, { interactionId: INTERACTION_ID, rolloutMode: "shadow" });

    expect(ragProgrammeTelemetryForAnswer(answer)).toMatchObject({
      query_plan_kind: "single",
      material_ambiguity: false,
      coverage_counts: { conflicting: 1 },
      candidate_match_counts: null,
    });
  });

  it("preserves retrieval facts while recomputing a generated danger-source refusal", () => {
    const retrievedSource = {
      id: "source-chunk-1",
      document_id: "source-document-1",
      title: "Superseded clinical guideline",
      file_name: "superseded-guideline.pdf",
      page_number: 2,
      chunk_index: 0,
      section_heading: "Monitoring",
      content: "Use the superseded monitoring pathway.",
      image_ids: [],
      images: [],
      similarity: 0.91,
      source_metadata: {
        source_title: "Superseded clinical guideline",
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
    } satisfies SearchResult;
    const original = observeRagAnswer(
      {
        answer: "Use the superseded monitoring pathway.",
        grounded: true,
        confidence: "high",
        citations: [
          {
            chunk_id: retrievedSource.id,
            document_id: retrievedSource.document_id,
            title: retrievedSource.title,
            file_name: retrievedSource.file_name,
            page_number: retrievedSource.page_number,
            chunk_index: retrievedSource.chunk_index,
          },
        ],
        sources: [retrievedSource],
        routingMode: "strong",
        modelUsed: "gpt-5.6",
        retrievalDiagnostics: {
          candidateCount: 7,
          retrievalDepth: 7,
          distinctDocumentCount: 3,
          topScore: 0.91,
          secondScore: 0.84,
          scoreSpread: 0.07,
          gateStatus: "passed",
        },
      } satisfies RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );
    const refused = buildGovernedAnswerClientResponse(original);

    expect(refused.refused).toBe(true);
    expect(ragProgrammeTelemetryForAnswer(refused.telemetryAnswer)).toMatchObject({
      interaction_id: INTERACTION_ID,
      candidate_counts: { uploaded_local: 7 },
      selected_counts: { uploaded_local: 1 },
      coverage_counts: { direct: 0, partial: 0, conflicting: 0, absent: 1 },
      insufficiency_reason: "governance_block",
      fallback_reason_code: "source_governance_block",
      generation_outcome: "failed",
    });
  });
});
