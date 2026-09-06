/**
 * The published rating method — one definition, read by the scorer and by the
 * pages that explain it.
 *
 * The band thresholds used to live twice: as literals inside `assessSource`
 * (`catalogue-core.ts`) and re-typed as prose on `/sources/method`. Nothing made
 * the two agree, so the catalogue could publish a method it no longer applied.
 * `catalogue-core` now bands through `qualityBandForScore` below, and the
 * reference surfaces render this same table, so a threshold change moves both.
 */

import type { SemanticTone } from "@/lib/semantic-tone";

import { SOURCE_RATING_WEIGHTS, type SourceQualityBand } from "./catalogue-types";

/** The Sources mode's method page. Declared once so hrefs are never hand-typed. */
export const SOURCE_METHOD_ROUTE = "/sources/method";

/** The filtered catalogue, restricted to one quality band. */
export function sourceBandBrowseHref(band: SourceQualityBand): string {
  return `/sources/search?band=${band}`;
}

export type SourceRatingDimension = {
  key: keyof typeof SOURCE_RATING_WEIGHTS;
  label: string;
  points: number;
  description: string;
};

/**
 * Ordered by weight, heaviest first: the order is the point of the list. Points
 * are read from the scoring weights rather than restated, so a re-weighting
 * cannot leave the published dimensions describing the old split.
 */
export const SOURCE_RATING_DIMENSIONS: readonly SourceRatingDimension[] = [
  {
    key: "accuracyAssurance",
    label: "Accuracy assurance",
    points: SOURCE_RATING_WEIGHTS.accuracyAssurance,
    description: "Version review, validation or an explicit check",
  },
  {
    key: "reliability",
    label: "Reliability",
    points: SOURCE_RATING_WEIGHTS.reliability,
    description: "Publisher authority, provenance and independence",
  },
  {
    key: "evidenceQuality",
    label: "Evidence quality",
    points: SOURCE_RATING_WEIGHTS.evidenceQuality,
    description: "The declared evidence or reference type",
  },
  {
    key: "currency",
    label: "Currency",
    points: SOURCE_RATING_WEIGHTS.currency,
    description: "Publication, review, expiry and supersession state",
  },
  {
    key: "australianApplicability",
    label: "Australian applicability",
    points: SOURCE_RATING_WEIGHTS.australianApplicability,
    description: "WA, national, state or international applicability",
  },
  {
    key: "traceability",
    label: "Traceability",
    points: SOURCE_RATING_WEIGHTS.traceability,
    description: "Identity, version, dates, location and registered usage",
  },
] as const;

/** Every dimension at full marks. The scale the bars and the score are drawn against. */
export const SOURCE_RATING_TOTAL_POINTS = SOURCE_RATING_DIMENSIONS.reduce(
  (total, dimension) => total + dimension.points,
  0,
);

/**
 * Bands never take the clinical tone: clinical blue means "an action to carry
 * out", which a quality band is not. Narrowed here so a band cannot acquire one.
 */
export type SourceBandTone = Exclude<SemanticTone, "clinical">;

export type SourceQualityBandDefinition = {
  band: SourceQualityBand;
  label: string;
  tone: SourceBandTone;
  /**
   * Inclusive lower bound of the band's score window, or `null` where the band
   * is not reached by score at all: `excluded` is applied before any score, and
   * `D` also catches material identity or verification uncertainty at any score.
   */
  minScore: number | null;
  /** Inclusive upper bound; `null` alongside a `null` `minScore`. */
  maxScore: number | null;
  /** The band's own definition, without its range — the range is rendered from the bounds. */
  description: string;
};

/**
 * Ordered strongest to weakest, then `excluded`, which is a governance outcome
 * rather than a rung of the same ladder.
 */
export const SOURCE_QUALITY_BAND_SCALE: readonly SourceQualityBandDefinition[] = [
  {
    band: "A",
    label: "A · Preferred",
    tone: "success",
    minScore: 85,
    maxScore: 100,
    description: "Complete metadata, an authoritative publisher and a current, validated version.",
  },
  {
    band: "B",
    label: "B · Strong",
    tone: "info",
    minScore: 70,
    maxScore: 84,
    description: "Sound and usable, with one weaker dimension such as currency or applicability.",
  },
  {
    band: "C",
    label: "C · Supplementary",
    tone: "neutral",
    minScore: 50,
    maxScore: 69,
    description: "Usable as supporting material alongside a stronger source, not on its own.",
  },
  {
    band: "D",
    label: "D · Review required",
    tone: "warning",
    minScore: null,
    maxScore: null,
    description: "Below 50, incomplete metadata, or material identity or verification uncertainty at any score.",
  },
  {
    band: "excluded",
    label: "Excluded",
    tone: "danger",
    minScore: null,
    maxScore: null,
    description:
      "Applied before any score when lifecycle or governance rules reject the source, including an identified replacement.",
  },
] as const;

/** Band label lookup, shared by the catalogue list, the source record and the method page. */
export const SOURCE_BAND_LABELS = Object.fromEntries(
  SOURCE_QUALITY_BAND_SCALE.map((definition) => [definition.band, definition.label]),
) as Record<SourceQualityBand, string>;

/** Band tone lookup. One vocabulary, so a band never changes colour between surfaces. */
export const SOURCE_BAND_TONES = Object.fromEntries(
  SOURCE_QUALITY_BAND_SCALE.map((definition) => [definition.band, definition.tone]),
) as Record<SourceQualityBand, SourceBandTone>;

/**
 * The score-derived rungs only, strongest first. `assessSource` walks this after
 * it has already ruled out exclusion and material uncertainty, so the two
 * unbounded bands are deliberately absent.
 */
const SCORED_BANDS = SOURCE_QUALITY_BAND_SCALE.filter(
  (definition): definition is SourceQualityBandDefinition & { minScore: number } => definition.minScore !== null,
);

/**
 * The band a clean score falls in. Callers must have already handled exclusion
 * and material uncertainty; a score below every window is `D`.
 */
export function qualityBandForScore(score: number): SourceQualityBand {
  return SCORED_BANDS.find((definition) => score >= definition.minScore)?.band ?? "D";
}

export type SourceStatusDefinition = {
  label: string;
  tone: SemanticTone;
  definition: string;
};

export type SourceStatusGroup = {
  /** The catalogue axis. The three status axes are independent of one another. */
  heading: string;
  /** What the axis answers, shown under the heading. */
  summary: string;
  statuses: readonly SourceStatusDefinition[];
};

/**
 * Tones match what the catalogue itself renders, so the reference and the rows
 * it explains cannot disagree. `sourceAttentionFlags` remains the authority for
 * the four statuses it flags; `tests/source-rating-method.test.ts` holds them level.
 */
export const SOURCE_CATALOGUE_STATUS_GROUPS: readonly SourceStatusGroup[] = [
  {
    heading: "Currentness",
    summary: "Whether the publisher still considers this version in date.",
    statuses: [
      {
        label: "Current",
        tone: "success",
        definition: "The structured status says the source is within its current review period.",
      },
      {
        label: "Review due",
        tone: "warning",
        definition: "An explicit upstream status says the source is due for structured review.",
      },
      {
        label: "Outdated",
        tone: "danger",
        definition: "The source is past its structured expiry date or is explicitly marked outdated.",
      },
      {
        label: "Unknown currentness",
        tone: "neutral",
        definition: "A malformed expiry does not establish currentness, so currentness remains unknown.",
      },
    ],
  },
  {
    heading: "Validation",
    summary: "Whether the source has been checked locally, and how far that check went.",
    statuses: [
      {
        label: "Approved",
        tone: "success",
        definition: "The source carries an explicit approved clinical validation status.",
      },
      {
        label: "Locally reviewed",
        tone: "info",
        definition: "The source has a recorded local review but is not marked approved.",
      },
      { label: "Unverified", tone: "warning", definition: "The source is explicitly marked as not yet verified." },
      {
        label: "Unknown validation",
        tone: "neutral",
        definition: "No structured clinical validation status was supplied.",
      },
    ],
  },
  {
    heading: "Lifecycle",
    summary: "Whether the catalogue still uses the source, or only retains it.",
    statuses: [
      { label: "Active", tone: "success", definition: "The source remains available for current catalogue use." },
      {
        label: "Inactive",
        tone: "warning",
        definition: "The source is retained for traceability but is not currently active.",
      },
      {
        label: "Excluded",
        tone: "danger",
        definition: "A lifecycle or governance rule removes the source from normal catalogue use.",
      },
    ],
  },
  {
    heading: "Content mode",
    summary: "How much of the source the catalogue actually holds.",
    statuses: [
      {
        label: "Indexed content",
        tone: "success",
        definition: "The source content can be searched inside the application.",
      },
      {
        label: "Link only",
        tone: "info",
        definition: "The catalogue stores a governed outbound location, not searchable source content.",
      },
      {
        label: "Metadata only",
        tone: "neutral",
        definition: "Only structured identity and review metadata are available to the catalogue.",
      },
    ],
  },
] as const;

export type SourceMethodBoundary = {
  /** Short label for the statement, so the card is scannable before it is read. */
  title: string;
  statement: string;
};

/** What the score bounds, and what it does not measure. */
export const SOURCE_METHOD_BOUNDARIES: readonly SourceMethodBoundary[] = [
  {
    title: "Local relevance is capped",
    statement:
      "Australian applicability is bounded within 15 points. Weak Australian material cannot bypass identity, validation, lifecycle or evidence-quality controls.",
  },
  {
    title: "Nothing is inferred",
    statement:
      "Missing fields remain unknown. The catalogue does not infer publisher, jurisdiction, evidence type, version, approval or currentness from titles or prose.",
  },
  {
    title: "Missing metadata is demoted, not guessed",
    statement:
      "Missing publisher, version, dates, jurisdiction, evidence type or validation forces D · Review required. A past expiry receives no current currency credit; a source with an identified replacement is excluded.",
  },
] as const;

/**
 * The boundary of the whole page, kept apart from the three above. It is the
 * clinical governance statement, not the fourth item of a list, and the
 * reference surfaces give it its own treatment.
 */
export const SOURCE_METHOD_DISCLAIMER =
  "This organisational rating is not RAG relevance or patient-specific guidance, specialist sign-off, clinical endorsement, or a measurement of factual truth.";
