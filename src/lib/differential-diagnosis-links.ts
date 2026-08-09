import { cleanDifferentialItem } from "@/lib/differential-detail";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import type { DifferentialRecord } from "@/lib/differential-snapshot";

/**
 * Clinical synonym bridge for differentials display labels → diagnosis slugs.
 * Hand-reviewed only — not fuzzy search. Keys are lowercase cleaned phrases.
 * Do not add substring/contains rules; those produce false positives
 * (e.g. "respiratory depression" → Depression).
 *
 * Keys must not duplicate exact catalog titles (those already resolve via the
 * title map). Prefer aliases for clinical shorthand and composite phrases.
 */
export const DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES: Readonly<Record<string, string>> = {
  "superimposed delirium": "delirium",
  "quiet delirium": "hypoactive-delirium",
  "hypoactive quiet delirium": "hypoactive-delirium",
  "anticholinergic delirium": "delirium",
  "severe delirium": "delirium",
  "delirium tremens": "delirium",
  "occult delirium": "delirium",
  "missed delirium": "delirium",
  "malignant catatonia": "catatonia-severe-psychomotor-shutdown",
  "severe akathisia": "akathisia",
  "primary psychosis": "schizophrenia",
  "true psychosis": "schizophrenia",
  "severe depression": "major-depressive-disorder",
  "severe melancholic depression": "psychotic-depression-severe-melancholic-depression",
  "psychotic depression / severe melancholic depression": "psychotic-depression-severe-melancholic-depression",
  "medical psychosis": "acute-psychosis",
  "autoimmune psychosis": "autoimmune-encephalitis-autoimmune-psychosis",
  "autoimmune encephalitis / autoimmune psychosis": "autoimmune-encephalitis-autoimmune-psychosis",
  gad: "generalised-anxiety-disorder",
  dlb: "lewy-body-dementia-parkinson-disease-dementia",
  "borderline pd": "borderline-personality-disorder",
  "narcissistic pd": "narcissistic-personality-disorder",
  "antisocial pd": "antisocial-personality-disorder",
  "bipolar depression / mixed state": "mixed-state",
  "mania / mixed state": "mania-mixed-state",
  stimulant: "stimulant-intoxication-withdrawal",
  "methamphetamine / stimulant": "stimulant-intoxication-withdrawal",
  intoxication: "substance-intoxication",
  "medication overdose": "medication-toxicity-anticholinergic-burden-dopaminergic-or-steroid-psychosis",
  "antidepressant-induced switch": "antidepressant-induced-switching",
  "parkinson disease dementia": "dementia-with-lewy-bodies-parkinson-disease-dementia",
  "neurocognitive disorder": "dementia-neurocognitive-disorder",
};

export type DiagnosisTermMatchBy = "title" | "alias";

export type ResolvedDiagnosisTerm = {
  slug: string;
  href: string;
  matchedBy: DiagnosisTermMatchBy;
};

export type DiagnosisTermSegment = {
  text: string;
  slug: string | null;
  href: string | null;
  matchedBy: DiagnosisTermMatchBy | null;
};

export type ResolveDiagnosisTermOptions = {
  excludeSlug?: string | null;
  titleMap?: Map<string, string>;
  routableSlugs?: ReadonlySet<string>;
};

/** Diagnosis info href for a catalog slug. */
export function differentialDiagnosisHref(slug: string): string {
  return `/differentials/diagnoses/${slug}`;
}

/** First cleaned title wins when multiple records share a display title. */
export function buildDiagnosisTitleSlugMap(records: readonly DifferentialRecord[]): Map<string, string> {
  const titleToSlug = new Map<string, string>();
  for (const record of records) {
    const key = cleanDifferentialItem(record.title).toLowerCase();
    if (key && !titleToSlug.has(key)) titleToSlug.set(key, record.slug);
  }
  return titleToSlug;
}

export function isClinicalHingeLabel(value: string): boolean {
  return /^clinical hinge\b/i.test(value.trim());
}

function defaultRecords() {
  return loadDifferentialSnapshot().diagnoses;
}

function defaultTitleMap() {
  return buildDiagnosisTitleSlugMap(defaultRecords());
}

function defaultRoutableSlugs() {
  return new Set(defaultRecords().map((record) => record.slug));
}

function resolveSingleCleaned(
  cleaned: string,
  titleMap: Map<string, string>,
  routableSlugs: ReadonlySet<string>,
  excludeSlug?: string | null,
): ResolvedDiagnosisTerm | null {
  if (!cleaned || isClinicalHingeLabel(cleaned)) return null;
  const key = cleaned.toLowerCase();

  const fromTitle = titleMap.get(key);
  if (fromTitle && routableSlugs.has(fromTitle) && fromTitle !== excludeSlug) {
    return { slug: fromTitle, href: differentialDiagnosisHref(fromTitle), matchedBy: "title" };
  }

  const fromAlias = DIFFERENTIAL_DIAGNOSIS_TERM_ALIASES[key];
  if (fromAlias && routableSlugs.has(fromAlias) && fromAlias !== excludeSlug) {
    return { slug: fromAlias, href: differentialDiagnosisHref(fromAlias), matchedBy: "alias" };
  }

  return null;
}

/**
 * Resolve a discrete display label to a diagnosis page when it is an exact
 * cleaned catalog title or a curated alias. Never fuzzy/substring matches.
 */
export function resolveDiagnosisTerm(
  label: string,
  options: ResolveDiagnosisTermOptions = {},
): ResolvedDiagnosisTerm | null {
  const cleaned = cleanDifferentialItem(label);
  const titleMap = options.titleMap ?? defaultTitleMap();
  const routableSlugs = options.routableSlugs ?? defaultRoutableSlugs();
  return resolveSingleCleaned(cleaned, titleMap, routableSlugs, options.excludeSlug);
}

const SEGMENT_SPLIT = /\s*[,;]\s*/;

/**
 * Split composite presentation tags / comma lists into ordered segments and
 * resolve each independently (exact title, then alias).
 */
export function resolveDiagnosisTermSegments(
  label: string,
  options: ResolveDiagnosisTermOptions = {},
): DiagnosisTermSegment[] {
  const cleaned = cleanDifferentialItem(label);
  if (!cleaned) return [];
  if (isClinicalHingeLabel(cleaned)) {
    return [{ text: cleaned, slug: null, href: null, matchedBy: null }];
  }

  const titleMap = options.titleMap ?? defaultTitleMap();
  const routableSlugs = options.routableSlugs ?? defaultRoutableSlugs();

  const whole = resolveSingleCleaned(cleaned, titleMap, routableSlugs, options.excludeSlug);
  if (whole) {
    return [{ text: cleaned, slug: whole.slug, href: whole.href, matchedBy: whole.matchedBy }];
  }

  const parts = cleaned
    .split(SEGMENT_SPLIT)
    .map((part) => cleanDifferentialItem(part))
    .filter(Boolean);
  if (parts.length <= 1) {
    return [{ text: cleaned, slug: null, href: null, matchedBy: null }];
  }

  return parts.map((part) => {
    const resolved = resolveSingleCleaned(part, titleMap, routableSlugs, options.excludeSlug);
    return {
      text: part,
      slug: resolved?.slug ?? null,
      href: resolved?.href ?? null,
      matchedBy: resolved?.matchedBy ?? null,
    };
  });
}

/** Build cleaned-label → slug map for SSR payloads (whole labels only). */
export function buildTermLinkMap(
  labels: Iterable<string>,
  options: ResolveDiagnosisTermOptions = {},
): Record<string, string> {
  const titleMap = options.titleMap ?? defaultTitleMap();
  const routableSlugs = options.routableSlugs ?? defaultRoutableSlugs();
  const links: Record<string, string> = {};
  for (const label of labels) {
    const cleaned = cleanDifferentialItem(label);
    if (!cleaned || links[cleaned]) continue;
    const resolved = resolveSingleCleaned(cleaned, titleMap, routableSlugs, options.excludeSlug);
    if (resolved) links[cleaned] = resolved.slug;
  }
  return links;
}
