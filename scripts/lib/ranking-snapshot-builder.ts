import { contentTermAlternatives, documentLabelAlternatives } from "./clinical-aliases";
import type { RankingCandidateFeatures } from "./ranking-tuning";

export type ArtifactScoreExplanation = {
  lexicalCoverageScore?: number;
  weightedHybridScore?: number;
  rrfBoost?: number;
  sectionTitleMatchBoost?: number;
  titleBoost?: number;
  metadataMatchScore?: number;
  metadataBoost?: number;
  clinicalSignalBoost?: number;
  penalty?: number;
  fusionSignals?: Partial<RankingCandidateFeatures>;
};

export type ArtifactCandidate = {
  chunk_id?: string;
  title?: string;
  file_name?: string;
  hybrid_score?: number;
  similarity?: number;
  content_preview?: string;
  score_explanation?: ArtifactScoreExplanation;
};

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizedTokens(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function labelMatches(text: string, label: string): boolean {
  const normalizedText = ` ${normalizedTokens(text)} `;
  return label
    .split(/\s+OR\s+/i)
    .map(normalizedTokens)
    .filter(Boolean)
    .some((part) => normalizedText.includes(` ${part} `));
}

/**
 * Alias-aware document matching: a candidate identifies the expected document when its
 * title/file text token-matches the fixture label or any sanctioned document alias. Mirrors
 * the live eval's documentExpectationAlternatives so snapshot relevance grades agree with the
 * gates — without this, alias-satisfied hits (e.g. the EMHS agitation guideline) grade as
 * misses and the tuner learns from mislabeled data.
 */
export function documentLabelMatchesWithAliases(documentText: string, label: string): boolean {
  return documentLabelAlternatives(label).some((alternative) => labelMatches(documentText, alternative));
}

/**
 * Alias-aware content matching: artifact content labels are contentExpectationLabel output —
 * "a OR b" alternates — and each alternate additionally expands through the sanctioned
 * content aliases (e.g. "ciwa" also matches the corpus's hyphenated "CIWA-Ar").
 */
export function contentLabelMatchesWithAliases(contentText: string, label: string): boolean {
  return label
    .split(/\s+OR\s+/i)
    .filter(Boolean)
    .some((part) => contentTermAlternatives(part).some((alternative) => labelMatches(contentText, alternative)));
}

function lexicalContribution(coverage: number): number {
  const density = Math.min(0.08, Math.max(0, coverage) * 0.08);
  const direct = coverage >= 0.75 ? 0.08 : coverage >= 0.5 ? 0.035 : coverage <= 0.2 ? -0.08 : 0;
  return round6(density + direct);
}

export function candidateFeatures(candidate: ArtifactCandidate): RankingCandidateFeatures {
  const explanation = candidate.score_explanation ?? {};
  const fusionSignals = explanation.fusionSignals;
  if (fusionSignals) {
    return {
      hybridRelevance: round6(finite(fusionSignals.hybridRelevance)),
      lexicalCoverage: round6(finite(fusionSignals.lexicalCoverage)),
      reciprocalRankFusion: round6(finite(fusionSignals.reciprocalRankFusion)),
      titleSectionRelevance: round6(finite(fusionSignals.titleSectionRelevance)),
      metadataRelevance: round6(finite(fusionSignals.metadataRelevance)),
      clinicalEvidence: round6(finite(fusionSignals.clinicalEvidence)),
      fixedAdjustment: round6(finite(fusionSignals.fixedAdjustment)),
    };
  }

  const coverage = finite(explanation.lexicalCoverageScore);
  const lexical = lexicalContribution(coverage);
  const titleSection = finite(explanation.sectionTitleMatchBoost);
  const title = finite(explanation.titleBoost);
  const sectionContribution = titleSection - title;
  return {
    hybridRelevance: round6(
      finite(explanation.weightedHybridScore, Math.min(1, finite(candidate.hybrid_score, candidate.similarity ?? 0))),
    ),
    lexicalCoverage: lexical,
    reciprocalRankFusion: round6(finite(explanation.rrfBoost)),
    titleSectionRelevance: round6(titleSection),
    metadataRelevance: round6(Math.max(0, finite(explanation.metadataMatchScore))),
    clinicalEvidence: round6(finite(explanation.clinicalSignalBoost) - lexical - sectionContribution),
    fixedAdjustment: round6(Math.min(0, finite(explanation.metadataBoost)) + Math.min(0, finite(explanation.penalty))),
  };
}
