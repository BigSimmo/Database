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
  /** Search-result fallback for paths that do not populate `answer.sources`. */
  sources?: SearchResult[];
  /** Render trust, passed through rather than re-derived. */
  weakEvidence?: boolean;
};

/** The projection every answer surface reads, from the payload they all hold. */
export function answerStateForAnswer({ answer, sources, weakEvidence }: AnswerCopyInput): AnswerState {
  return answerStateFromRetrieval({
    sources: answer.sources ?? sources,
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
  return composeAnswerClipboardText({
    renderCopyText,
    sourceOnly: answer.answerQualityTier === "source_only",
    state: answerStateForAnswer({ answer, sources, weakEvidence }),
  });
}
