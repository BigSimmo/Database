/**
 * The answer-state vocabulary, in the layer that owns domain types.
 *
 * These declarations lived in `@/components/ui/answer-state` next to the
 * projection that builds them. That was fine while only components read them,
 * and stopped being fine when `#208` put `composeAnswerClipboardText()` in
 * `src/lib`: `tests/lib-layering.test.ts` forbids `src/lib` importing
 * `@/components/**`, and a clipboard payload is domain output, not UI.
 *
 * Copying the union into `src/lib` instead would have been the worse fix. The
 * clipboard reads it deeply — `state.overdue`, `state.retrieved`,
 * `state.reason` — so a second copy would drift silently against the `#207`
 * precedence rules, on the code that decides what caveat lands in a clinical
 * record. One definition, in the lower layer, re-exported upward.
 *
 * `answerStateFromRetrieval()` and its structural input types stay with the
 * design system: the projection reads a retrieval payload and is UI-facing
 * policy, while these types are the shared vocabulary both layers speak.
 */

export type SourceRef = {
  sourceId: string;
  title: string;
  locator?: string;
};

/** The two governance states that make a source overdue. `unknown` is not one of them. */
export type OverdueStatus = "review_due" | "outdated";

export type OverdueSource = SourceRef & {
  /**
   * ISO review date, or `null` when governance has flagged the source
   * `review_due`/`outdated` without recording the date it was due.
   *
   * COMPONENTS §2 drafted this as a required `string`. It is widened here
   * deliberately: dropping a dateless overdue source from the banner to satisfy
   * the narrower type would hide the single most alarming case — a source known
   * to be past review with no recorded review commitment at all. `DateDisplay`
   * renders the absence as `Not recorded` rather than inventing a date.
   */
  reviewDueOn: string | null;
  /**
   * Which governance state made it overdue. Carried rather than collapsed:
   * `review_due` is a document still in force whose review has come around,
   * `outdated` is one that has been superseded. Rendering the second in the
   * first's vocabulary tells a clinician a withdrawn guideline is merely due.
   */
  status: OverdueStatus;
};

/**
 * Why an answer is not grounded in the sources it cites. Ordered by breadth of
 * consequence, and read in that order when several apply: the first two are
 * whole-answer facts, the third names specific claims, the fourth is a
 * derived-signal bucket.
 */
export type UngroundedReason = "grounded_false" | "confidence_unsupported" | "unverified_numeric" | "weak_evidence";

/** States an AnswerCard may render. */
export type AnswerState =
  | { kind: "ready"; sourceCount: number }
  | { kind: "stale_evidence"; overdue: OverdueSource[]; sourceCount: number }
  | { kind: "partial_retrieval"; retrieved: number; requested: number; missing: SourceRef[] }
  /**
   * The evidence is current and complete, and prose was produced, but the
   * pipeline itself reports that the prose is not supported by that evidence.
   *
   * Without this kind the projection reported such an answer as `ready`, which
   * is the exact failure SPEC §13 (PR 6 → PR 13 blocker) names: adopting
   * `AnswerCard` would have retired the live "Review source match" caution
   * (`evidence-panels.tsx`, `answer-thread-turn.tsx`) with nothing taking its
   * place. `ready` must never be reachable from a `grounded: false` answer.
   */
  | { kind: "ungrounded"; reason: UngroundedReason; sourceCount: number }
  | { kind: "source_only"; reason: "generation_failed" | "quality_gate" };

/** Deliberately NOT an AnswerState: no card may render it. */
export type NoAnswer = {
  kind: "no_answer";
  reason: "offline" | "no_confident_answer";
  lastSyncAt?: string;
};

export type DegradedAnswerState = Exclude<AnswerState, { kind: "ready" }>;
