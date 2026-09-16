/**
 * Specifiers mode clinical-governance boundary (#Z3GZ5P).
 *
 * These exports are the runtime binding for "aide-memoire reference only, not
 * automated clinical decision support". UI surfaces must read from here rather
 * than relying on comment-only notes in catalogue modules. Do not flip
 * SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT or drop option-level review badges
 * without an explicit owner governance decision and TGA/SaMD re-check.
 */

export const SPECIFIERS_USAGE_MODE = "aide-memoire-reference-only" as const;

/** Hard false until an owner decision reclassifies Specifiers as CDS. */
export const SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT = false;

/**
 * Option-level ReviewStatusBadge must stay visible on builder/search/detail
 * surfaces while clinician review remains pending (#Z3GZ5P / PR #2726).
 */
export const SPECIFIERS_REQUIRE_OPTION_REVIEW_BADGE = true;

/** Canonical safety-note copy consumed by SpecifierSafetyNote. */
export const SPECIFIERS_SAFETY_NOTE =
  "Use this as an aide-memoire reference only, not automated clinical decision support. Confirm the current diagnostic manual criteria, exclusions, episode chronology, and local clinical requirements before documenting a specifier.";
