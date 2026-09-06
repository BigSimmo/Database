import type { ClinicalSourceCatalogueEntry, SourceCatalogueWarning } from "@/lib/sources/catalogue-types";

/**
 * A source's state, said in the words a clinician would use.
 *
 * Two projections, deliberately separate because they answer different
 * questions and belong in different places:
 *
 * - `sourceAttentionFlags` — "should I be careful with this before I open it".
 *   Currency, supersession and lifecycle. Short enough to sit on a card in a
 *   list without turning the list into prose.
 * - `sourceProvenanceNotes` — "what specifically is wrong with this record".
 *   Identity, location safety, metadata conflict, completeness and clinical
 *   validation. These belong on the record itself, where there is room to say
 *   what the problem is rather than implying it with a band letter.
 *
 * The stored warning codes (`ambiguous_identity`, `unsafe_location`) never
 * reach the screen. A D band with no explanation tells a clinician a source is
 * suspect without telling them why, which is the failure this second projection
 * exists to prevent.
 */

export type SourceStatusFlag = { label: string; tone: "warning" | "danger" };

export function sourceAttentionFlags(entry: ClinicalSourceCatalogueEntry): readonly SourceStatusFlag[] {
  const flags: SourceStatusFlag[] = [];
  // Outdated outranks review-due, and excluded outranks inactive: the more
  // serious state is the one that governs, so only it is shown.
  if (entry.documentStatus === "outdated") flags.push({ label: "Outdated", tone: "danger" });
  else if (entry.documentStatus === "review_due") flags.push({ label: "Review due", tone: "warning" });
  if (entry.supersededBy.length) flags.push({ label: "Superseded", tone: "danger" });
  if (entry.lifecycleStatus === "excluded") flags.push({ label: "Excluded", tone: "danger" });
  else if (entry.lifecycleStatus === "inactive") flags.push({ label: "Inactive", tone: "warning" });
  return flags;
}

/** Warnings whose meaning `sourceAttentionFlags` already carries; repeating them is noise. */
const flagCoveredWarnings: ReadonlySet<SourceCatalogueWarning> = new Set(["outdated", "superseded"]);

const noteByWarning: Partial<Record<SourceCatalogueWarning, string>> = {
  ambiguous_identity: "The source could not be identified with certainty",
  unsafe_location: "The recorded link is not a verified secure location",
  metadata_conflict: "Recorded details about this source disagree with each other",
  invalid_date: "A recorded date could not be read",
  unknown_jurisdiction: "The jurisdiction this source applies to is unknown",
  unknown_evidence_type: "The kind of evidence this source carries is unknown",
  verification_unknown: "Whether this source has been verified is unknown",
};

/** The three separate completeness warnings say one thing to a reader, so they say it once. */
const missingDetailWarnings: ReadonlySet<SourceCatalogueWarning> = new Set([
  "missing_publisher",
  "missing_version",
  "missing_dates",
]);

const noteByValidationStatus: Partial<Record<ClinicalSourceCatalogueEntry["validationStatus"], string>> = {
  unverified: "Marked as not yet clinically verified",
  unknown: "No clinical validation status was recorded",
};

export function sourceProvenanceNotes(entry: ClinicalSourceCatalogueEntry): readonly string[] {
  const notes: string[] = [];

  for (const warning of entry.warnings) {
    if (flagCoveredWarnings.has(warning)) continue;
    const note = noteByWarning[warning];
    if (note && !notes.includes(note)) notes.push(note);
  }

  if (entry.warnings.some((warning) => missingDetailWarnings.has(warning))) {
    notes.push("Key record details are missing");
  }

  const validationNote = noteByValidationStatus[entry.validationStatus];
  if (validationNote) notes.push(validationNote);

  return notes;
}
