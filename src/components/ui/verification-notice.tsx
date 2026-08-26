import { Info, TriangleAlert } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { DateDisplay } from "@/components/ui/date-display";

/**
 * COMPONENTS §1. The AI-verification wording was a call-site convention, so a
 * generated answer could render without it, with drifted wording, or with
 * wording a lay reader cannot use. The system owns the words; the call site may
 * only choose the state it is in — there is no children prop and no text prop.
 *
 * Wording changes here are spec changes and need the clinical owner's review.
 * Never interpolate a model name, a vendor name, or a confidence percentage:
 * naming the model invites the reader to calibrate trust on the brand instead
 * of on the cited source.
 */

export type VerificationState = "ready" | "stale_evidence" | "partial_retrieval" | "ungrounded" | "source_only";

export type VerificationNoticeProps = {
  /** Drives the approved wording variant. Never free text. */
  state: VerificationState;
  /** "plain" is the lay-reader variant for patient/carer-facing prints (factsheets). */
  audience?: "clinician" | "plain";
  /**
   * Who produced the prose. Never inferred from `state`: `#207` precedence lets
   * `stale_evidence`, `partial_retrieval` and `ungrounded` outrank
   * `source_only`, so an extractive answer reports one of those kinds and would
   * otherwise be announced as "AI-generated" over passages no model wrote.
   * Callers pass the quality tier, not the state kind. Ledger `#228`.
   */
  attribution?: "model" | "extractive";
  /**
   * Keeps the complete governed wording by default. Production answer surfaces
   * may opt into a shorter, still-complete clinical instruction on phones;
   * larger screens and print always retain the full wording.
   *
   * `"inline"` is the chat-framed answer's variant, approved by the clinical
   * owner on 2026-08-25. It renders the same approved compact instruction at
   * every screen width as one quiet line, and print still receives the complete
   * governed wording, so the audit artefact is unchanged. What it gives up is
   * volume, not words: on a `source_only` answer the full block, the support
   * eyebrow and the Source-only disclosure stated one caution three times in
   * eleven lines, and three identical alarms teach a reader to skip all three
   * (the reasoning already recorded for `#227` in answer-card.tsx).
   *
   * Caution states keep the warning icon and the warning colour even here —
   * quieting a caution is not the same as removing the distinction between a
   * caution and a routine notice.
   */
  presentation?: "full" | "responsive-compact" | "inline";
  /** Print rendering is self-contained: no wording may depend on the live link. */
  medium?: "screen" | "print";
  sourceCount?: number;
  /** Print medium only; ISO. Rendered through DateDisplay. */
  printedAt?: string;
  printedBy?: string;
  className?: string;
};

const WORDING: Record<"clinician" | "plain", Record<VerificationState, string>> = {
  clinician: {
    // "ready" still carries the disclaimer: ready is not verified.
    ready:
      "AI-generated from the cited sources. Verify every clinical claim against the linked source before acting on it.",
    // "some of which": the banner below reports the exact fraction, and this
    // line must not assert that every cited source is overdue when it is not.
    stale_evidence:
      "AI-generated from cited sources, some of which are past their review date. Re-verify every clinical claim against the linked source before acting on it.",
    partial_retrieval:
      "AI-generated from an incomplete set of sources. Some sources for this question were unavailable, so this answer may omit relevant guidance. Verify against the linked sources before acting on it.",
    // Deliberately narrower than "this answer is wrong": the checks establish
    // that support could not be shown, not that a claim was refuted. It still
    // names the numerals, because that is the claim class the faithfulness
    // check flags and the one a clinician acts on directly.
    ungrounded:
      "AI-generated, and the cited sources could not be shown to support every claim in it. Read the cited passages and confirm each clinical number, dose, timing and threshold there before acting on it.",
    source_only:
      "Assembled directly from the cited sources without model synthesis. The passages are real and cited, but they have not been summarised. Verify against the linked sources before acting on them.",
  },
  plain: {
    ready:
      "A computer wrote this summary from the documents listed below. Check it with your treating team before acting on it.",
    stale_evidence:
      "A computer wrote this summary from documents that are overdue for review, so parts of it may be out of date. Check it with your treating team before acting on it.",
    partial_retrieval:
      "A computer wrote this summary, and some documents could not be included, so it may be incomplete. Check it with your treating team before acting on it.",
    ungrounded:
      "A computer wrote this summary, and we could not confirm that the documents listed below say everything it says. Do not act on it without checking with your treating team.",
    source_only:
      "This summary is copied straight from the documents listed below rather than written by a computer. Check it with your treating team before acting on it.",
  },
};

/**
 * Wording for an answer assembled from source passages rather than written by a
 * model, in the states that outrank `source_only`.
 *
 * `#207` precedence puts `stale_evidence`, `partial_retrieval` and `ungrounded`
 * above `source_only`, so an extractive answer that is also stale, partial or
 * unsupported reports one of those kinds — and every one of their wordings opens
 * with "AI-generated". The result was two contradictory provenance claims on one
 * answer: this notice saying a model wrote it, directly above the Source-only
 * disclosure saying no model did. A clinician cannot weigh an answer without
 * knowing which.
 *
 * Attribution cannot be inferred from the kind, which is exactly why the
 * clipboard composer takes an explicit `sourceOnly` flag (`#208`). This is the
 * on-screen counterpart. Each string keeps its state's full instruction and
 * changes only the provenance clause. Ledger `#228`.
 */
const EXTRACTIVE_WORDING: Record<"clinician" | "plain", Partial<Record<VerificationState, string>>> = {
  clinician: {
    stale_evidence:
      "Assembled directly from the cited sources without model synthesis, and some of those sources are past their review date. Re-verify every clinical claim against the linked source before acting on it.",
    partial_retrieval:
      "Assembled directly from an incomplete set of cited sources without model synthesis. Some sources for this question were unavailable, so this answer may omit relevant guidance. Verify against the linked sources before acting on it.",
    ungrounded:
      "Assembled directly from the cited sources without model synthesis, and those sources could not be shown to support every claim in it. Read the cited passages and confirm each clinical number, dose, timing and threshold there before acting on it.",
  },
  plain: {
    stale_evidence:
      "This summary is copied straight from the documents listed below rather than written by a computer, and those documents are overdue for review, so parts of it may be out of date. Check it with your treating team before acting on it.",
    partial_retrieval:
      "This summary is copied straight from the documents listed below rather than written by a computer, and some documents could not be included, so it may be incomplete. Check it with your treating team before acting on it.",
    ungrounded:
      "This summary is copied straight from the documents listed below rather than written by a computer, and we could not confirm that those documents say everything it says. Do not act on it without checking with your treating team.",
  },
};

const RESPONSIVE_COMPACT_WORDING: Record<"model" | "extractive", Record<VerificationState, string>> = {
  model: {
    ready: "AI-generated. Verify every clinical claim against the cited sources before acting.",
    stale_evidence: "AI-generated; some cited sources are overdue. Re-verify every clinical claim before acting.",
    partial_retrieval:
      "AI-generated from incomplete sources and may omit guidance. Verify against cited sources before acting.",
    ungrounded:
      "AI-generated. Sources could not be shown to support every claim. Check each dose, number, timing and threshold before acting.",
    source_only: "Copied from cited sources without model synthesis. Verify against the cited sources before acting.",
  },
  extractive: {
    ready: "Copied from cited sources without model synthesis. Verify against the cited sources before acting.",
    stale_evidence: "Copied from cited sources; some are overdue. Re-verify every clinical claim before acting.",
    partial_retrieval:
      "Copied from incomplete sources and may omit guidance. Verify against cited sources before acting.",
    ungrounded:
      "Copied from cited sources without model synthesis. Sources could not be shown to support every claim. Check each dose, number, timing and threshold before acting.",
    source_only: "Copied from cited sources without model synthesis. Verify against the cited sources before acting.",
  },
};

const UNKNOWN_RESPONSIVE_COMPACT_WORDING =
  "Answer provenance is unknown. Treat it as unverified and check every clinical claim against the cited sources before acting.";

/**
 * Wording for a state this build does not recognise — a newer producer, a bad
 * cast, a partially-deployed rollout. A verification notice is the one surface
 * where the neutral variant is the *weakest* thing to say, so an unknown state
 * falls back to the most cautionary wording available rather than to `ready`.
 * It asserts nothing specific about the sources, because nothing specific is known.
 */
const UNKNOWN_STATE_WORDING: Record<"clinician" | "plain", string> = {
  clinician:
    "AI-generated, and the provenance of this answer could not be established. Treat it as unverified and check every clinical claim against the linked source before acting on it.",
  plain:
    "A computer wrote this summary, and we could not establish where it came from. Do not act on it without checking with your treating team.",
};

/**
 * Source-currency caution wears the warning role. Never danger red — this is not
 * clinical hazard.
 *
 * `ungrounded` joins it rather than sitting on the neutral info role: the live
 * product already paints "Review source match" in the warning channel
 * (`answer-thread-turn.tsx`, `evidence-panels.tsx` tone `caution`), and adoption
 * that quietly demoted that caution to informational would lose the signal
 * #207 exists to preserve.
 */
const CAUTION_STATES = new Set<VerificationState>(["stale_evidence", "ungrounded"]);

const MAX_RECORDED_UNKNOWN_STATES = 32;
const loggedUnknownStates = new Set<string>();

function recordUnknownState(key: string): boolean {
  if (loggedUnknownStates.has(key)) return false;
  if (loggedUnknownStates.size >= MAX_RECORDED_UNKNOWN_STATES) {
    const oldest = loggedUnknownStates.values().next().value;
    if (typeof oldest === "string") loggedUnknownStates.delete(oldest);
  }
  loggedUnknownStates.add(key);
  return true;
}

/** Test-only seam for the bounded process-local unknown-state diagnostic recorder. */
export function recordUnknownVerificationNoticeStateForTests(key: string): boolean {
  return recordUnknownState(key);
}

/** Test-only seam for asserting FIFO eviction without exposing diagnostic state to callers. */
export function recordedUnknownVerificationNoticeStateKeysForTests(): string[] {
  return [...loggedUnknownStates];
}

/** Test-only reset for the process-local unknown-state diagnostic recorder. */
export function resetRecordedUnknownVerificationNoticeStatesForTests() {
  loggedUnknownStates.clear();
}

function wordingFor(
  audience: "clinician" | "plain",
  state: VerificationState,
  attribution: "model" | "extractive",
): string {
  // Only the provenance clause changes; the state's instruction is unchanged,
  // and an unrecognised state still falls through to the most cautionary text.
  if (attribution === "extractive") {
    const extractive = EXTRACTIVE_WORDING[audience][state];
    if (extractive) return extractive;
  }
  const wording = WORDING[audience][state];
  if (wording) return wording;

  const key = `${audience}:${String(state)}`;
  if (recordUnknownState(key)) {
    if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "verification-notice: unrecognized state, using most cautionary wording",
          field: "state",
          value: String(state),
        }),
      );
    }
  }
  return UNKNOWN_STATE_WORDING[audience];
}

export function VerificationNotice({
  state,
  audience = "clinician",
  attribution = "model",
  presentation = "full",
  medium = "screen",
  sourceCount,
  printedAt,
  printedBy,
  className,
}: VerificationNoticeProps) {
  const wording = wordingFor(audience, state, attribution);
  const showResponsiveCompact =
    presentation === "responsive-compact" && audience === "clinician" && medium === "screen";
  // Same governed strings as responsive-compact, held at every width rather than
  // only below `sm`. Print is excluded deliberately: the complete wording is what
  // the printed record has to carry.
  const showInline = presentation === "inline" && audience === "clinician" && medium === "screen";
  const compactWording = RESPONSIVE_COMPACT_WORDING[attribution]?.[state] ?? UNKNOWN_RESPONSIVE_COMPACT_WORDING;
  // An unrecognised state is treated as caution: it wears the warning mark for
  // the same reason it gets the strongest wording.
  const caution = CAUTION_STATES.has(state) || !WORDING[audience][state];
  const Icon = caution ? TriangleAlert : Info;

  return (
    <aside
      data-testid="verification-notice"
      data-state={state}
      data-audience={audience}
      data-attribution={attribution}
      data-medium={medium}
      data-presentation={presentation}
      // Deliberately not a live region and not focusable: it is standing
      // document text above the answer actions, not an event. Print CSS may
      // never hide or clamp it, so no line-clamp and no print:hidden here.
      //
      // Responsive compact renders its separately approved clinician wording on
      // phones; the complete governed wording returns from `sm` and in print.
      // Neither variant is clamped, collapsed behind a disclosure, or dropped
      // on a small screen. At `text-sm`, the complete block costs 160px above
      // the prose on a 390px phone and pushes the answer's scroll runway past
      // the in-flow chrome activation band (tests/ui-smoke.spec.ts:2224,
      // ledger #226).
      className={cn(
        "flex items-start gap-2 text-[color:var(--text-muted)]",
        showInline
          ? // One quiet line above the prose. Print restores the full block below.
            "gap-1.5 text-2xs leading-4 print:text-xs print:leading-5"
          : "text-xs leading-5 sm:text-sm sm:leading-6",
        caution ? "text-[color:var(--warning)]" : null,
        className,
      )}
    >
      {showInline && !caution ? null : (
        <Icon
          aria-hidden="true"
          className={cn("shrink-0", showInline ? "mt-px size-icon-xs" : "mt-0.5 size-icon-sm")}
        />
      )}
      <div className="min-w-0">
        {showInline ? (
          <>
            <p data-testid="verification-notice-compact" className="print:hidden">
              {compactWording}
            </p>
            <p data-testid="verification-notice-full" className="hidden print:block">
              {wording}
            </p>
          </>
        ) : showResponsiveCompact ? (
          <>
            <p data-testid="verification-notice-compact" className="sm:hidden print:hidden">
              {compactWording}
            </p>
            <p data-testid="verification-notice-full" className="hidden sm:block print:block">
              {wording}
            </p>
          </>
        ) : (
          <p data-testid="verification-notice-full">{wording}</p>
        )}
        {typeof sourceCount === "number" ? (
          // A count, not a warning, and the Sources control sits directly below
          // it on screen already saying the same number — so it is the one line
          // here that a phone can spend. Kept in the DOM and restored from `sm`
          // and in print, where it is part of the audit artefact.
          <p
            data-testid="verification-notice-sources"
            className={cn(showInline ? "hidden print:block" : "hidden sm:block print:block")}
          >
            {sourceCount === 1 ? "Based on 1 cited source." : `Based on ${sourceCount} cited sources.`}
          </p>
        ) : null}
        {medium === "print" && (printedAt || printedBy) ? (
          <p data-testid="verification-notice-print-stamp">
            {printedAt ? (
              <>
                {"Printed "}
                <DateDisplay value={printedAt} kind="generated" />
              </>
            ) : null}
            {printedBy ? `${printedAt ? " by " : "Printed by "}${printedBy}` : null}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
