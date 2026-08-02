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

export type VerificationState = "ready" | "stale_evidence" | "partial_retrieval" | "source_only";

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
    stale_evidence:
      "AI-generated from cited sources that are past their review date. Re-verify every clinical claim against the linked source before acting on it.",
    partial_retrieval:
      "AI-generated from an incomplete set of sources. Some sources for this question were unavailable, so this answer may omit relevant guidance. Verify against the linked sources before acting on it.",
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
    source_only:
      "This summary is copied straight from the documents listed below rather than written by a computer. Check it with your treating team before acting on it.",
  },
};

/** Source-currency caution wears the warning role. Never danger red — this is not clinical hazard. */
const CAUTION_STATES = new Set<VerificationState>(["stale_evidence"]);

export function VerificationNotice({
  state,
  audience = "clinician",
  medium = "screen",
  sourceCount,
  printedAt,
  printedBy,
  className,
}: VerificationNoticeProps) {
  const caution = CAUTION_STATES.has(state);
  const Icon = caution ? TriangleAlert : Info;
  const wording = WORDING[audience][state] ?? WORDING[audience].ready;

  return (
    <aside
      data-testid="verification-notice"
      data-state={state}
      data-audience={audience}
      data-medium={medium}
      // Deliberately not a live region and not focusable: it is standing
      // document text above the answer actions, not an event. Print CSS may
      // never hide or clamp it, so no line-clamp and no print:hidden here.
      className={cn(
        "flex items-start gap-2 text-sm text-[color:var(--text-muted)]",
        caution ? "text-[color:var(--warning)]" : null,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
      <div className="min-w-0">
        <p>{wording}</p>
        {typeof sourceCount === "number" ? (
          <p data-testid="verification-notice-sources">
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
