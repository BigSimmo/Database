import type { AnswerState } from "@/components/ui/answer-state";
import { clipboardProvenanceLine, normalizeSourceMetadata } from "@/lib/source-metadata";
import type { ClinicalSourceMetadata } from "@/lib/types";

/**
 * PR-J Phase 1 blocker 2 of 2 (ledger `#208`, SPEC §13 PR 6 clinical review 1).
 *
 * Two copy formatters exist and they are not interchangeable:
 *
 * - `formatAnswerRenderCopyText()` (`answer-render-policy.ts`) is what the live
 *   product copies today, through `buildAnswerRenderModel().copyText`. It carries
 *   the render policy's own **warnings** — faithfulness, unverified numerics,
 *   trust — plus clinical tables, numbered sources with match strength, and
 *   displayed table evidence.
 * - `answerClipboardText()` (`components/ui/answer-card.tsx`) is the design-system
 *   primitive. It carries unconditional attribution, the `AnswerState` caveat and
 *   the single-document provenance suppression rule, but none of the warnings.
 *
 * **The decision: compose, do not replace.** The render-policy string stays the
 * primary product clipboard payload. Swapping it for `answerClipboardText` would
 * drop the warnings the UI has already decided the clinician must see, which is
 * the "clean prose in the chart" hazard SPEC records. Instead this composer wraps
 * the render-policy string with the three things it lacks, so nothing is lost in
 * either direction, and the attribution/caveat/provenance rules keep exactly one
 * implementation — the helpers below, shared with `answerClipboardText`.
 *
 * Rejected: switching product `onCopy` to `answerClipboardText` alone; keeping two
 * divergent product copy paths without a single composer.
 */

export type AnswerClipboardMetadataInput = Partial<ClinicalSourceMetadata> | null;

/**
 * Whose words a paste is. Unconditional, including on `ready`: a copied answer
 * loses the banner, the notice and the links, so clinical prose with nothing
 * attached reads in a record as though a clinician wrote and endorsed it.
 *
 * `sourceOnly` exists because the state alone cannot answer this question since
 * `#207`. The projection's precedence puts `ungrounded` above `source_only`, so
 * an extractive answer that is also weakly supported reports `ungrounded` — and
 * keying attribution on the kind would then paste "AI-generated" over passages
 * no model wrote. A caller that knows `answerQualityTier` passes it and the
 * paste stays factually true about its own provenance.
 */
export function answerStateAttribution(state: AnswerState, options?: { sourceOnly?: boolean }): string {
  return options?.sourceOnly === true || state.kind === "source_only"
    ? "Assembled directly from the cited sources without model synthesis."
    : "AI-generated from the cited sources.";
}

const UNGROUNDED_CAVEAT: Record<Extract<AnswerState, { kind: "ungrounded" }>["reason"], string> = {
  grounded_false:
    "this answer could not be matched to the sources it cites. Verify every clinical claim in the cited passages before relying on it.",
  confidence_unsupported:
    "this answer is reported as unsupported by the sources it cites. Verify every clinical claim in the cited passages before relying on it.",
  unverified_numeric:
    "some clinical values in this answer were not found in the cited sources. Verify every number, dose, route, timing and threshold in the cited passages before relying on it.",
  weak_evidence:
    "the evidence supporting this answer is weak. Verify every clinical claim in the cited passages before relying on it.",
};

/**
 * The degraded-state sentence, or `null` on `ready`. Returned without the
 * `Caveat: ` prefix so a caller can place it in its own document structure;
 * `answerClipboardCaveatLine()` is the prefixed form both current callers use.
 */
export function answerStateCaveat(state: AnswerState): string | null {
  switch (state.kind) {
    case "stale_evidence":
      return state.overdue.length > 0
        ? `${state.overdue.length} of ${state.sourceCount} cited sources are past their review date.`
        : // Defensive: the banner guards this state, and a count of zero would
          // argue against the caution it is attached to.
          "some cited sources are past their review date.";
    case "partial_retrieval":
      return `only ${state.retrieved} of ${state.requested} sources were available for this answer.`;
    case "ungrounded":
      return UNGROUNDED_CAVEAT[state.reason];
    default:
      return null;
  }
}

export function answerClipboardCaveatLine(state: AnswerState): string | null {
  const caveat = answerStateCaveat(state);
  return caveat ? `Caveat: ${caveat}` : null;
}

/**
 * `metadata` describes ONE document. On a multi-source stale answer, "1 of 6
 * cited sources are past their review date" followed by "Review status: Current"
 * reads as a correction of the caveat, so the line is suppressed. An absent
 * record is also suppressed: synthesising an all-`Unknown` line would assert a
 * governance read that never happened.
 */
export function answerClipboardProvenanceLine(
  state: AnswerState,
  metadata?: AnswerClipboardMetadataInput,
): string | null {
  if (metadata == null) return null;
  if (state.kind === "stale_evidence" && state.sourceCount > 1) return null;
  return clipboardProvenanceLine(normalizeSourceMetadata(metadata));
}

/**
 * Wrap the live product's render-policy copy string with the safety lines it does
 * not carry.
 *
 * Attribution and the caveat go **above** the render block rather than appended:
 * a paste that is truncated, quoted, or trimmed by an EMR keeps its head far more
 * often than its tail, and those two lines are the ones that must survive. The
 * provenance audit line goes last, matching `answerClipboardText` and the single
 * `clipboardProvenanceLine()` implementation.
 *
 * `renderCopyText` is passed through byte-for-byte. Warnings, render trust,
 * numbered sources, tables and displayed evidence are the render policy's to
 * decide, and this composer does not edit, reorder or re-derive any of them.
 */
export function composeAnswerClipboardText({
  renderCopyText,
  state,
  metadata,
  sourceOnly,
}: {
  /** `buildAnswerRenderModel(answer).copyText` — the primary product payload. */
  renderCopyText: string;
  state: AnswerState;
  /** Provenance for a SINGLE document, when the surface has one. */
  metadata?: AnswerClipboardMetadataInput;
  /**
   * `answerQualityTier === "source_only"`. Pass it whenever the caller has it:
   * since `#207`, `ungrounded` outranks `source_only` in the projection, so the
   * state alone can no longer be trusted to say whether a model wrote the prose.
   */
  sourceOnly?: boolean;
}): string {
  const body = renderCopyText.trim();
  const head = [answerStateAttribution(state, { sourceOnly }), answerClipboardCaveatLine(state)]
    .filter(Boolean)
    .join("\n");
  const provenance = answerClipboardProvenanceLine(state, metadata);

  return [head, body, provenance].filter(Boolean).join("\n\n").trim();
}
