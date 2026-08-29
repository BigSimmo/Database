import { cn } from "@/components/ui-primitives";
import { createBoundedDiagnosticRecorder } from "@/components/ui/design-system-diagnostics";

/**
 * COMPONENTS §3. In clinical data a bare dash reads as a negative result: an
 * empty potassium cell and a normal potassium cell look the same, and "we never
 * recorded this" is indistinguishable from "this does not apply". The phrase is
 * the whole component — there is no children prop, no icon-only form, and no
 * density at which the wording contracts back to a dash.
 *
 * Two of the six reasons say the value is absent only for now, and they are not
 * interchangeable with the four that describe a record:
 *
 *   not_yet_calculated     — no value exists yet because the user has not
 *                            finished supplying what it is derived from. It
 *                            asserts nothing about the record, and must never
 *                            be used where the input is complete.
 *   withheld_until_complete — a value could be produced from what has been
 *                            entered so far, and the surface is deliberately
 *                            not publishing it, because a partial reading would
 *                            be clinically misleading. The phrase names the
 *                            release condition on purpose: a clinician told only
 *                            that something is "withheld" will go looking for
 *                            it. Deliberately narrow — this is suppression
 *                            pending completion, not redaction, and SPEC §11
 *                            still has no redaction phrase.
 */

export type MissingValueReason =
  | "not_recorded"
  | "not_applicable"
  | "unknown"
  | "extraction_failed"
  | "not_yet_calculated"
  | "withheld_until_complete";

export type MissingValueProps = {
  reason: MissingValueReason;
  /** "cell" tightens spacing for dense tables; the phrase is never abbreviated. */
  density?: "inline" | "cell";
  className?: string;
};

const PHRASES: Record<MissingValueReason, string> = {
  not_recorded: "Not recorded",
  not_applicable: "Not applicable",
  unknown: "Unknown",
  extraction_failed: "Unable to extract",
  not_yet_calculated: "Not yet calculated",
  withheld_until_complete: "Withheld until complete",
};

const recordUnknownReason = createBoundedDiagnosticRecorder({
  emit: (message) => {
    if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") console.warn(message);
  },
});

/** Enum resilience per SPEC §7: an unrecognised reason renders `Unknown` and never throws. */
export function missingValuePhrase(reason: MissingValueReason): string {
  const phrase = Object.hasOwn(PHRASES, reason) ? PHRASES[reason] : undefined;
  if (typeof phrase === "string") return phrase;
  const key = String(reason);
  recordUnknownReason(
    key,
    JSON.stringify({ level: "warn", message: "missing-value: unrecognized reason", field: "reason", value: key }),
  );
  return PHRASES.unknown;
}

export function MissingValue({ reason, density = "inline", className }: MissingValueProps) {
  return (
    <span
      data-testid="missing-value"
      data-reason={reason}
      // --text-muted, never --decoration-soft: this is text carrying meaning, and
      // the decoration tier is asserted below the contrast threshold (Gate 1).
      className={cn("text-[color:var(--text-muted)]", density === "cell" ? "text-xs" : "text-sm", className)}
    >
      {missingValuePhrase(reason)}
    </span>
  );
}
