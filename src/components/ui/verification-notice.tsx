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

const loggedUnknownStates = new Set<string>();

function wordingFor(audience: "clinician" | "plain", state: VerificationState): string {
  const wording = WORDING[audience][state];
  if (wording) return wording;

  const key = `${audience}:${String(state)}`;
  if (!loggedUnknownStates.has(key)) {
    loggedUnknownStates.add(key);
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
  medium = "screen",
  sourceCount,
  printedAt,
  printedBy,
  className,
}: VerificationNoticeProps) {
  const wording = wordingFor(audience, state);
  // An unrecognised state is treated as caution: it wears the warning mark for
  // the same reason it gets the strongest wording.
  const caution = CAUTION_STATES.has(state) || !WORDING[audience][state];
  const Icon = caution ? TriangleAlert : Info;

  return (
    <aside
      data-testid="verification-notice"
      data-state={state}
      data-audience={audience}
      data-medium={medium}
      // Deliberately not a live region and not focusable: it is standing
      // document text above the answer actions, not an event. Print CSS may
      // never hide or clamp it, so no line-clamp and no print:hidden here.
      //
      // Compact on phones, full size from `sm`. Every word survives at every
      // width — the notice is the safety content and is never clamped, never
      // collapsed behind a disclosure, and never dropped on a small screen.
      // What changes is only the type scale, because at `text-sm` this block
      // costs 160px above the prose on a 390px phone and pushes the answer's
      // scroll runway past the in-flow chrome activation band
      // (tests/ui-smoke.spec.ts:2224, ledger #226).
      className={cn(
        "flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6",
        caution ? "text-[color:var(--warning)]" : null,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
      <div className="min-w-0">
        <p>{wording}</p>
        {typeof sourceCount === "number" ? (
          // A count, not a warning, and the Sources control sits directly below
          // it on screen already saying the same number — so it is the one line
          // here that a phone can spend. Kept in the DOM and restored from `sm`
          // and in print, where it is part of the audit artefact.
          <p data-testid="verification-notice-sources" className="hidden sm:block print:block">
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
