import type { ClinicalSourceMetadata } from "@/lib/types";

/**
 * COMPONENTS §2. Degraded, partial and fallback answers are structurally
 * identical to confident ones unless the state is a value the type system sees.
 * `AnswerCard` takes one of these as a required prop, so "we forgot the caveat"
 * stops being representable.
 */

export type SourceRef = {
  sourceId: string;
  title: string;
  locator?: string;
};

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
};

/** States an AnswerCard may render. */
export type AnswerState =
  | { kind: "ready"; sourceCount: number }
  | { kind: "stale_evidence"; overdue: OverdueSource[]; sourceCount: number }
  | { kind: "partial_retrieval"; retrieved: number; requested: number; missing: SourceRef[] }
  | { kind: "source_only"; reason: "generation_failed" | "quality_gate" };

/** Deliberately NOT an AnswerState: no card may render it. */
export type NoAnswer = {
  kind: "no_answer";
  reason: "offline" | "no_confident_answer";
  lastSyncAt?: string;
};

export type DegradedAnswerState = Exclude<AnswerState, { kind: "ready" }>;

/**
 * The subset of a retrieval answer that the state projection reads. Structural
 * rather than a direct `RagAnswer` import so the design-system bundle does not
 * pull the retrieval layer in, while `tests/answer-state-contract.test.ts` pins
 * that a real `RagAnswer` still satisfies it.
 */
export type AnswerStateSource = {
  id?: string | null;
  document_id?: string | null;
  title?: string | null;
  page_number?: number | null;
  source_metadata?: Pick<ClinicalSourceMetadata, "document_status" | "review_date"> | null;
};

export type AnswerStateInput = {
  sources?: readonly AnswerStateSource[] | null;
  answerQualityTier?: "model_synthesis" | "source_only" | "cached" | null;
  fallbackReason?: string | null;
  routingReason?: string | null;
};

/**
 * `generation_failed` means the model call itself fell over and the pipeline
 * assembled the answer from sources locally; everything else that produces a
 * source-only answer (retrieval confidence gates, governance refusal, low
 * signal) is a `quality_gate`. The discriminator reads the routing marker the
 * retrieval layer already stamps onto the client payload — it does not
 * re-derive the decision.
 */
const generationFallbackMarker = /generation_fallback|generation_failed/i;

function overdueSourceFrom(source: AnswerStateSource): OverdueSource | null {
  const status = source.source_metadata?.document_status;
  // Only the two governance-set overdue states. `unknown` is not overdue — it is
  // unknown, and the source badges say so in their own vocabulary.
  if (status !== "review_due" && status !== "outdated") return null;
  const sourceId = source.document_id?.trim() || source.id?.trim();
  if (!sourceId) return null;
  return {
    sourceId,
    title: source.title?.trim() || "Untitled source",
    locator: typeof source.page_number === "number" ? `p. ${source.page_number}` : undefined,
    reviewDueOn: source.source_metadata?.review_date?.trim() || null,
  };
}

/**
 * Project the app-facing retrieval payload onto the state the answer surface
 * renders. This is a projection of fields the retrieval layer has already
 * decided — `document_status` is server-set governance, not a date comparison —
 * so the review policy stays where COMPONENTS §2 puts it.
 *
 * Precedence is by clinical consequence, highest first:
 *
 *   1. `stale_evidence`  — the cited evidence may no longer be correct.
 *   2. `partial_retrieval` — the evidence base is incomplete.
 *   3. `source_only`     — evidence is current and complete; only the synthesis
 *                          is degraded.
 *   4. `ready`.
 *
 * A source-only answer over overdue sources therefore reports `stale_evidence`
 * here. The source-only disclosure is not lost: `AnswerCard` carries the
 * verification wording as its own required prop, so the call site states both.
 *
 * `partial_retrieval` is never produced today — no app-facing field names which
 * expected sources were unavailable. See `docs/design-system/COMPONENTS.md` §2.
 */
export function answerStateFromRetrieval(input: AnswerStateInput): AnswerState {
  const sources = input.sources ?? [];
  const sourceCount = sources.length;
  const overdue = sources.map(overdueSourceFrom).filter((entry): entry is OverdueSource => entry !== null);

  if (overdue.length > 0) return { kind: "stale_evidence", overdue, sourceCount };

  if (input.answerQualityTier === "source_only") {
    const marker = `${input.fallbackReason ?? ""} ${input.routingReason ?? ""}`;
    return {
      kind: "source_only",
      reason: generationFallbackMarker.test(marker) ? "generation_failed" : "quality_gate",
    };
  }

  return { kind: "ready", sourceCount };
}
