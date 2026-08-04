import { SourceDesignationBadge } from "prompt-for-codex-medical-knowledge-base";

// Designation is derived from the source-authority registry, not passed in: it
// answers "who issued this", which is a different axis from currency
// (SourceStatusBadge) and local approval (SourceProvenance). None of the three
// implies the others — Official does not mean current or locally approved.
export const Official = () => (
  <SourceDesignationBadge metadata={{ publisher: "Sir Charles Gairdner Hospital", jurisdiction: "WA" }} />
);

export const Trusted = () => (
  <SourceDesignationBadge metadata={{ publisher: "Royal Australian and New Zealand College of Psychiatrists" }} />
);

export const Unclassified = () => <SourceDesignationBadge metadata={{}} />;

// An off-vocabulary or unrecognised publisher degrades to Unclassified rather
// than guessing — and, since the browser-safety fix, without unmounting.
export const OffVocabulary = () => (
  <SourceDesignationBadge metadata={{ publisher: "Unknown clinic", clinical_validation_status: "validated" }} />
);
