// Building the clipboard payload for an answer, in one place.
//
// Three surfaces copy an answer — the live one in `ClinicalDashboard`, a prior
// thread turn, and the inline answer surface — and each was assembling the same
// `answerStateFromRetrieval()` input by hand from the same nine payload fields.
// Three hand-assembled copies of a projection input is how the copy paths drift
// apart, and #208 exists precisely because one of them once claimed
// "AI-generated" over passages no model wrote.
//
// It lives in the clinical-dashboard layer rather than `src/lib` because it
// reaches into `@/components/ui/answer-state`, and `tests/lib-layering.test.ts`
// forbids `src/lib` importing components. It stays out of the design system for
// the mirror-image reason recorded on `AnswerStateInput`: the DS projection
// takes a structural shape so the design-system bundle never pulls the
// retrieval layer in, and `RagAnswer` is the retrieval layer.

import { answerStateFromRetrieval, type AnswerState } from "@/components/ui/answer-state";
import { composeAnswerClipboardText } from "@/lib/answer-clipboard";
import type { RagAnswer, SearchResult } from "@/lib/types";

export type AnswerCopyInput = {
  answer: RagAnswer;
  /**
   * Search-result fallback for paths that do not populate `answer.sources`.
   * An empty array is treated as unpopulated — `??` alone would keep `[]` and
   * drop overdue-source warnings that only the fallback still carries.
   */
  sources?: SearchResult[];
  /** Render trust, passed through rather than re-derived. */
  weakEvidence?: boolean;
};

/**
 * Prefer the answer's cited set when it has entries; otherwise use the caller's
 * fallback. `RagAnswer.sources` is typed as a required array, so "not populated"
 * arrives as `[]` rather than `undefined`, and nullish coalescing is the wrong
 * operator for that contract.
 */
export function resolveAnswerSources(
  answerSources: SearchResult[] | null | undefined,
  fallback?: SearchResult[] | null,
): SearchResult[] | undefined {
  if (answerSources != null && answerSources.length > 0) return answerSources;
  if (fallback != null && fallback.length > 0) return fallback;
  return answerSources ?? fallback ?? undefined;
}

/** The projection every answer surface reads, from the payload they all hold. */
export function answerStateForAnswer({ answer, sources, weakEvidence }: AnswerCopyInput): AnswerState {
  return answerStateFromRetrieval({
    sources: resolveAnswerSources(answer.sources, sources),
    citations: answer.citations,
    answerQualityTier: answer.answerQualityTier,
    fallbackReason: answer.fallbackReason,
    routingReason: answer.routingReason,
    grounded: answer.grounded,
    confidence: answer.confidence,
    unverifiedNumericTokens: answer.unverifiedNumericTokens,
    weakEvidence,
  });
}

/**
 * Provenance metadata for the clipboard audit line — only when the cited set
 * collapses to one document. Multi-document pastes suppress the line in the
 * composer (it would contradict a multi-source stale caveat).
 */
export function singleDocumentClipboardMetadata(
  sources: readonly SearchResult[] | null | undefined,
): SearchResult["source_metadata"] | undefined {
  if (!sources?.length) return undefined;
  const documentIds = new Set(
    sources.map((source) => source.document_id?.trim()).filter((id): id is string => Boolean(id)),
  );
  if (documentIds.size !== 1) return undefined;
  const withMetadata = sources.find((source) => source.source_metadata != null);
  return withMetadata?.source_metadata ?? undefined;
}

/**
 * The clipboard payload for an answer. `renderCopyText` stays the primary
 * product string and passes through byte-for-byte; the composer only adds what
 * leaves the app with it — attribution, the state caveat, and the provenance
 * audit line — because a copy is read in a record long after the banner is gone.
 *
 * `sourceOnly` is read from the quality tier rather than from the state kind:
 * #207 precedence puts `ungrounded` above `source_only`, so an extractive answer
 * that is also weakly supported reports `ungrounded`, and keying attribution on
 * the kind would paste "AI-generated" over passages no model wrote.
 */
export function buildAnswerClipboardText({
  answer,
  sources,
  weakEvidence,
  renderCopyText,
}: AnswerCopyInput & { renderCopyText: string }): string {
  const resolvedSources = resolveAnswerSources(answer.sources, sources);
  return composeAnswerClipboardText({
    renderCopyText,
    sourceOnly: answer.answerQualityTier === "source_only",
    state: answerStateForAnswer({ answer, sources, weakEvidence }),
    metadata: singleDocumentClipboardMetadata(resolvedSources),
  });
}
