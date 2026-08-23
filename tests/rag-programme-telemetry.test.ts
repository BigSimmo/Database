import { describe, expect, it } from "vitest";
import {
  buildRagQueryMetadata,
  buildRagProgrammeTelemetry,
  carryRagProgrammeTelemetry,
  observeRagAnswer,
  ragProgrammeTelemetryForAnswer,
  type RagProgrammeTelemetryInput,
} from "../src/lib/rag/rag-programme-telemetry";
import { toClientAnswerPayload } from "../src/lib/answer-client-payload";
import { buildAnswerLogRow } from "../src/lib/answer-telemetry";
import type { RagAnswer } from "../src/lib/types";

const INTERACTION_ID = "11111111-1111-4111-8111-111111111111";

function input(overrides: Partial<RagProgrammeTelemetryInput> = {}): RagProgrammeTelemetryInput {
  return {
    interactionId: INTERACTION_ID,
    rolloutMode: "legacy",
    queryPlanKind: "single",
    subquestionCount: 1,
    materialAmbiguity: false,
    coverageCounts: { direct: 1, partial: 0, conflicting: 0, absent: 0 },
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
      "generation_outcome",
      "verified_units_emitted",
      "verified_units_discarded",
      "reconciliation_outcome",
    ]);
    expect(JSON.stringify(projected)).not.toContain("patient-name-canary");
    expect(JSON.stringify(projected)).not.toContain("subquestion-text-canary");
    expect(JSON.stringify(projected)).not.toContain("provider-error-canary");
    expect(JSON.stringify(projected)).not.toContain("owner-id-canary");
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

  it("recomputes the final governed outcome while retaining the same opaque join", () => {
    const original = observeRagAnswer(
      {
        answer: "Candidate answer.",
        grounded: true,
        confidence: "high",
        citations: [],
        sources: [],
        routingMode: "strong",
        modelUsed: "gpt-5.6",
      } satisfies RagAnswer,
      { interactionId: INTERACTION_ID, rolloutMode: "legacy" },
    );
    const refused = carryRagProgrammeTelemetry(original, {
      ...original,
      answer: "Governance refusal.",
      grounded: false,
      confidence: "unsupported",
      routingMode: "unsupported",
      routingReason: "source_governance_refusal",
      fallbackReason: "source_governance_refusal",
      modelUsed: null,
    });

    expect(ragProgrammeTelemetryForAnswer(refused)).toMatchObject({
      interaction_id: INTERACTION_ID,
      insufficiency_reason: "governance_block",
      generation_outcome: "failed",
    });
  });
});
