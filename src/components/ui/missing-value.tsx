import { cn } from "@/components/ui-primitives";

/**
 * COMPONENTS §3. In clinical data a bare dash reads as a negative result: an
 * empty potassium cell and a normal potassium cell look the same, and "we never
 * recorded this" is indistinguishable from "this does not apply". The phrase is
 * the whole component — there is no children prop, no icon-only form, and no
 * density at which the wording contracts back to a dash.
 */

export type MissingValueReason = "not_recorded" | "not_applicable" | "unknown" | "extraction_failed";

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
};

const loggedUnknownReasons = new Set<string>();

/** Enum resilience per SPEC §7: an unrecognised reason renders `Unknown` and never throws. */
export function missingValuePhrase(reason: MissingValueReason): string {
  const phrase = Object.hasOwn(PHRASES, reason) ? PHRASES[reason] : undefined;
  if (typeof phrase === "string") return phrase;
  const key = String(reason);
  if (!loggedUnknownReasons.has(key)) {
    loggedUnknownReasons.add(key);
    if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
      console.warn(
        JSON.stringify({ level: "warn", message: "missing-value: unrecognized reason", field: "reason", value: key }),
      );
    }
  }
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
