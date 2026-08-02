import { describe, expect, it } from "vitest";

import { answerStateFromRetrieval, type AnswerStateInput, type AnswerStateSource } from "@/components/ui/answer-state";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import type { RagAnswer } from "@/lib/types";

/**
 * PR-E step 0 — the contract pre-check.
 *
 * `AnswerCard` takes `AnswerState` as a required prop, and COMPONENTS §2 forbids
 * the component from inferring staleness from dates: the review policy lives in
 * the source-governance layer. This file is the standing proof that the state
 * the answer surface needs is already present, and already typed, in the payload
 * the app layer receives — so building the answer-safety components required no
 * change to `src/lib/rag/**` or `src/lib/source-review.ts`.
 *
 * RECORDED GAP: `partial_retrieval` has no producer. Nothing in the app-facing
 * contract names which expected sources were unavailable — `retrievalDiagnostics`
 * carries candidate counts and `conflictsOrGaps` carries prose. The component is
 * built to its specified contract, but adoption (PR 13) can only emit `ready`,
 * `stale_evidence` and `source_only` until a separate RAG contract PR adds a
 * named missing-source signal. Do not synthesise one in the component layer.
 */

/** Compile-time proof: the real answer payload satisfies the projection's input shape. */
type AssignableTo<A, B> = A extends B ? true : false;
const ragAnswerSatisfiesProjectionInput: AssignableTo<
  Pick<RagAnswer, "sources" | "answerQualityTier" | "fallbackReason" | "routingReason">,
  AnswerStateInput
> = true;

function source(overrides: Partial<AnswerStateSource> & { metadata?: Record<string, unknown> }): AnswerStateSource {
  const { metadata, ...rest } = overrides;
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "WA Clozapine Protocol",
    page_number: 12,
    // Built through the real normalizer, so the projection is tested against the
    // governance enums the app actually receives rather than a hand-made shape.
    source_metadata: normalizeSourceMetadata(metadata ?? {}),
    ...rest,
  };
}

describe("PR-E step 0 · AnswerState reaches the app layer", () => {
  it("keeps the RagAnswer payload assignable to the projection input", () => {
    expect(ragAnswerSatisfiesProjectionInput).toBe(true);
  });

  it("reports a fully current answer as ready with its source count", () => {
    const state = answerStateFromRetrieval({
      sources: [source({ metadata: { document_status: "current" } }), source({ document_id: "doc-2" })],
    });

    expect(state).toEqual({ kind: "ready", sourceCount: 2 });
  });

  it("reads staleness from the server-set governance status, never from the date", () => {
    // A decade-old review date on a source governance still calls `current` is
    // not the component's business to overrule.
    const state = answerStateFromRetrieval({
      sources: [source({ metadata: { document_status: "current", review_date: "2015-01-01" } })],
    });

    expect(state.kind).toBe("ready");
  });

  it("raises stale_evidence for review_due and outdated sources", () => {
    const state = answerStateFromRetrieval({
      sources: [
        source({ metadata: { document_status: "review_due", review_date: "2025-11-01" } }),
        source({ document_id: "doc-2", metadata: { document_status: "outdated", review_date: "2024-02-02" } }),
        source({ document_id: "doc-3", metadata: { document_status: "current" } }),
      ],
    });

    expect(state.kind).toBe("stale_evidence");
    if (state.kind !== "stale_evidence") return;
    expect(state.sourceCount).toBe(3);
    expect(state.overdue).toHaveLength(2);
    expect(state.overdue[0]).toEqual({
      sourceId: "doc-1",
      title: "WA Clozapine Protocol",
      locator: "p. 12",
      reviewDueOn: "2025-11-01",
    });
  });

  it("does not treat an unknown review status as overdue", () => {
    const state = answerStateFromRetrieval({
      sources: [source({ metadata: { document_status: "unknown" } })],
    });

    expect(state.kind).toBe("ready");
  });

  it("keeps an overdue source whose review date was never recorded", () => {
    // Dropping it to satisfy a stricter type would hide the most alarming case:
    // known past review, with no recorded review commitment at all.
    const state = answerStateFromRetrieval({
      sources: [source({ metadata: { document_status: "outdated" } })],
    });

    expect(state.kind).toBe("stale_evidence");
    if (state.kind !== "stale_evidence") return;
    expect(state.overdue[0]?.reviewDueOn).toBeNull();
  });

  it("separates a failed generation from a failed quality gate", () => {
    const generationFailed = answerStateFromRetrieval({
      sources: [],
      answerQualityTier: "source_only",
      routingReason: "fast; generation_fallback: provider timeout",
    });
    expect(generationFailed).toEqual({ kind: "source_only", reason: "generation_failed" });

    const qualityGate = answerStateFromRetrieval({
      sources: [],
      answerQualityTier: "source_only",
      fallbackReason: "low_signal_retrieval_gate",
    });
    expect(qualityGate).toEqual({ kind: "source_only", reason: "quality_gate" });
  });

  it("treats a source-only answer over overdue sources as stale evidence first", () => {
    // Precedence is by clinical consequence: "the evidence may be wrong now"
    // outranks "the synthesis is degraded". The source-only disclosure still
    // reaches the reader through AnswerCard's separate verification prop.
    const state = answerStateFromRetrieval({
      sources: [source({ metadata: { document_status: "review_due", review_date: "2025-11-01" } })],
      answerQualityTier: "source_only",
      fallbackReason: "quality_gate",
    });

    expect(state.kind).toBe("stale_evidence");
  });

  it("never fabricates a partial_retrieval state, because nothing produces one", () => {
    const state = answerStateFromRetrieval({
      sources: [source({})],
      answerQualityTier: "model_synthesis",
    });

    expect(state.kind).not.toBe("partial_retrieval");
  });
});
