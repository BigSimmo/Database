import {
  classifyRagQuery,
  hasDoseEvidenceSupport,
  hasNumericOrTableEvidence,
  normalizedClinicalSearchTokens,
} from "@/lib/clinical-search";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { lowYieldSourceNoiseScore, sourceTextForModel } from "@/lib/source-text-sanitizer";
import type { RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";

const answerRankStrategy = "query_focused_answer_evidence_v2";

// Hardened boilerplate patterns to suppress generic medical disclaimers and
// document control noise that can bury unique clinical instructions.
const answerBoilerplatePattern =
  /\b(?:uncontrolled when printed|document control|review date|version\s+\d|page\s+\d+\s+of\s+\d+|copyright|confidential|all rights reserved|refer to the electronic version|consult your doctor|seek medical advice|this is not medical advice|intended for healthcare professionals|disclaimer)\b/i;

// Minimal "values only" bolding: emphasise only decision-critical detail — escalation/stop
// actions, numeric doses/thresholds/timings, and rating values. Topic nouns (clozapine, FBC,
// ANC, ECG, …) and query terms are intentionally NOT bolded; bolding them everywhere produced
// robotic, keyword-highlighted prose rather than natural clinical writing.
const fixedHighYieldPatterns = [
  /\b(?:withhold|withholding|cease|ceased|stop|stopping|discontinue\w*|contraindicat\w*|avoid|urgent|escalat\w*|red flag\w*)\b/gi,
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|mmol\/L|days?|weeks?|months?|hours?|minutes?|%)\b/gi,
  /\brating\s+\d+(?:\s*[-–]\s*\d+)?\b/gi,
];

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1.5, value));
}

function normalizeText(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9%/.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textTokens(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => (token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
    .filter((token) => token.length > 2);
}

function imageEvidenceText(result: SearchResult) {
  return (result.images ?? [])
    .filter((image) => isClinicalImageEvidence(image))
    .map((image) =>
      [
        image.image_type,
        image.sourceKind ?? image.source_kind,
        image.tableLabel,
        image.tableTitle,
        image.tableTextSnippet,
        image.caption,
        ...(image.labels ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

function resultTexts(result: SearchResult) {
  const labels = (result.document_labels ?? []).map((label) => `${label.label} ${label.label_type}`).join(" ");
  const metadataText = `${labels} ${result.document_summary ?? ""}`;
  const titleText = `${result.title} ${result.file_name}`;
  const sectionText = result.section_heading ?? "";
  const synopsisText = result.retrieval_synopsis ?? "";
  const contentText = `${sourceTextForModel(result.content)} ${imageEvidenceText(result)}`;
  return {
    title: normalizeText(titleText),
    section: normalizeText(sectionText),
    content: normalizeText(contentText),
    metadata: normalizeText(metadataText),
    adjacent: normalizeText(result.adjacent_context ?? ""),
    combined: normalizeText(
      `${titleText} ${sectionText} ${synopsisText} ${contentText} ${metadataText} ${result.adjacent_context ?? ""}`,
    ),
  };
}

function uniqueQueryTokens(query: string) {
  const tokens = normalizedClinicalSearchTokens(query);
  const fallback = tokens.length ? tokens : textTokens(query);
  return Array.from(new Set(fallback.filter((token) => token.length > 2)));
}

function tokenCoverage(tokens: string[], haystack: string) {
  if (!tokens.length || !haystack) return 0;
  const hits = tokens.filter((token) => haystack.includes(token));
  return hits.length / tokens.length;
}

function buildQueryPhrases(tokens: string[]): string[] {
  if (tokens.length < 2) return [];
  const phrases: string[] = [];
  for (let size = Math.min(4, tokens.length); size >= 2; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(" "));
    }
  }
  return phrases;
}

function phraseScore(phrases: string[], haystack: string) {
  if (!phrases.length || !haystack) return 0;
  const hits = phrases.filter((phrase) => haystack.includes(phrase)).length;
  return Math.min(1, hits / Math.max(1, Math.min(phrases.length, 4)));
}

function classSignalScore(queryClass: RagQueryClass, result: SearchResult, combinedText: string) {
  const hasTableEvidence = (result.images ?? []).some(
    (image) =>
      isClinicalImageEvidence(image) &&
      (image.image_type === "clinical_table" ||
        image.image_type === "medication_chart" ||
        image.sourceKind === "table_crop" ||
        image.source_kind === "table_crop"),
  );

  if (queryClass === "table_threshold") {
    return (
      (/\b(?:threshold|cut\s?off|withhold|cease|stop|anc|fbc|level|range|criteria|rating|table|chart)\b/i.test(
        combinedText,
      )
        ? 0.13
        : 0) + (hasTableEvidence ? 0.08 : 0)
    );
  }
  if (queryClass === "medication_dose_risk") {
    return hasDoseEvidenceSupport(result)
      ? 0.2
      : /\b(?:risk|toxicity|side effect|monitor)\b/i.test(combinedText)
        ? 0.06
        : 0;
  }
  if (queryClass === "document_lookup") {
    return /\b(?:document|guideline|procedure|protocol|form|section|appendix)\b/i.test(combinedText) ? 0.08 : 0;
  }
  if (queryClass === "comparison") {
    return /\b(?:requirement|process|procedure|criteria|include|document|action)\b/i.test(combinedText) ? 0.04 : 0;
  }
  if (queryClass === "broad_summary") {
    return /\b(?:summary|overview|purpose|scope|procedure|requirement|action)\b/i.test(combinedText) ? 0.04 : 0;
  }
  return 0;
}

function sourceQualityScore(result: SearchResult) {
  const metadata = result.source_metadata;
  let score = 0;
  if (metadata?.document_status === "outdated") score -= 0.04;
  if (metadata?.extraction_quality === "poor") score -= 0.04;
  return score;
}

function answerEvidenceScore(tokens: string[], phrases: string[], result: SearchResult, queryClass: RagQueryClass) {
  const texts = resultTexts(result);
  const base = Math.min(1, result.hybrid_score ?? result.similarity ?? 0) * 0.28;
  const contentCoverage = tokenCoverage(tokens, texts.content);
  const titleCoverage = tokenCoverage(tokens, texts.title);
  const sectionCoverage = tokenCoverage(tokens, texts.section);
  const metadataCoverage = tokenCoverage(tokens, texts.metadata);
  const combinedCoverage = tokenCoverage(tokens, texts.combined);
  const adjacentCoverage = tokenCoverage(tokens, texts.adjacent);
  const phraseCoverage = phraseScore(phrases, texts.combined);
  const directnessScore =
    contentCoverage * 0.34 + titleCoverage * 0.12 + sectionCoverage * 0.1 + metadataCoverage * 0.08;
  const weakOverlapPenalty = combinedCoverage < 0.2 ? -0.18 : combinedCoverage < 0.34 ? -0.07 : 0;
  const adjacentOnlyPenalty = contentCoverage < 0.16 && adjacentCoverage > contentCoverage ? -0.08 : 0;
  // The semantic reranker only runs for a narrow deterministic ambiguity band. Preserve its
  // bounded relevance signal here so the answer-specific ranking cannot silently undo it.
  const semanticRerankContribution = (result.score_explanation?.semanticRerankScore ?? 0) * 0.1;

  // Dynamic boilerplate suppression: heavier penalty for common disclaimers
  // that don't match the specific clinical query.
  const boilerplatePenalty = answerBoilerplatePattern.test(result.content) && contentCoverage < 0.35 ? -0.15 : 0;
  const lowYieldPenalty = lowYieldSourceNoiseScore(result.content) >= 0.35 && contentCoverage < 0.45 ? -0.12 : 0;

  const coreConceptTokens = tokens.filter(
    (token) =>
      ![
        "dose",
        "dosing",
        "dosage",
        "medication",
        "medicine",
        "route",
        "oral",
        "intramuscular",
        "monitor",
        "monitoring",
        "risk",
      ].includes(token),
  );
  // Exempt passages with real numeric/table evidence — a dose/threshold table row
  // holds the answer even when it doesn't repeat the drug name (RET-H2).
  const numericEvidenceExempt = hasNumericOrTableEvidence(result);
  const missingCoreConceptPenalty =
    queryClass === "medication_dose_risk" &&
    coreConceptTokens.length > 0 &&
    !numericEvidenceExempt &&
    !coreConceptTokens.some((token) => texts.combined.includes(token))
      ? -0.22
      : 0;
  const titleOnlyDosePenalty =
    queryClass === "medication_dose_risk" &&
    titleCoverage >= 0.4 &&
    !hasDoseEvidenceSupport(result) &&
    !numericEvidenceExempt
      ? -0.18
      : 0;

  return clampScore(
    base +
      directnessScore +
      phraseCoverage * 0.12 +
      classSignalScore(queryClass, result, texts.combined) +
      sourceQualityScore(result) +
      semanticRerankContribution +
      weakOverlapPenalty +
      adjacentOnlyPenalty +
      boilerplatePenalty +
      lowYieldPenalty +
      titleOnlyDosePenalty +
      missingCoreConceptPenalty,
  );
}

export function rankAnswerEvidence(
  query: string,
  results: SearchResult[],
  queryClass: RagQueryClass = classifyRagQuery(query).queryClass,
) {
  const tokens = uniqueQueryTokens(query);
  const phrases = buildQueryPhrases(tokens);
  const ranked = results
    .map((result, index) => ({
      result,
      index,
      score: answerEvidenceScore(tokens, phrases, result, queryClass),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.result.hybrid_score ?? b.result.similarity ?? 0) - (a.result.hybrid_score ?? a.result.similarity ?? 0) ||
        a.index - b.index,
    );

  return {
    rankedResults: ranked.map((item) => item.result),
    scoresByChunkId: new Map(ranked.map((item) => [item.result.id, Number(item.score.toFixed(4))])),
    topScore: ranked[0] ? Number(ranked[0].score.toFixed(4)) : 0,
    rankedSourceCount: ranked.length,
    strategy: answerRankStrategy,
    queryClass,
  };
}

function applyBoldPatternOutsideExisting(text: string, pattern: RegExp, maxMatches: number) {
  let applied = 0;
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith("**") && segment.endsWith("**")) return segment;
      return segment.replace(pattern, (match) => {
        if (applied >= maxMatches) return match;
        if (!/[A-Za-z0-9]/.test(match)) return match;
        applied += 1;
        return `**${match}**`;
      });
    })
    .join("");
}

function capBoldSegments(text: string, originalText: string, maxSegments = 4) {
  // Audit L14: allow only as many "free" (uncounted) passes of a bold string
  // as occurrences that existed in the original text. The previous Set-based
  // check let every NEWLY-bolded token identical to a pre-existing bold
  // phrase bypass the cap, so an answer could render far more than
  // maxSegments bold segments.
  const existingBoldCounts = new Map<string, number>();
  for (const match of originalText.matchAll(/\*\*([^*]+)\*\*/g)) {
    existingBoldCounts.set(match[1], (existingBoldCounts.get(match[1]) ?? 0) + 1);
  }
  let kept = 0;
  return text.replace(/\*\*([^*]+)\*\*/g, (match, content: string) => {
    const freePasses = existingBoldCounts.get(content) ?? 0;
    if (freePasses > 0) {
      existingBoldCounts.set(content, freePasses - 1);
      return match;
    }
    kept += 1;
    return kept <= maxSegments ? match : content;
  });
}

export function boldHighYieldClinicalText(text: string, query?: string) {
  if (!text.trim()) return text;
  if (query === undefined) return text;
  if (/[{}\[\]]/.test(text) && /"?(?:answer|heading|citation_chunk_ids|chunk_id)"?\s*:/i.test(text)) return text;
  let output = text;
  for (const pattern of fixedHighYieldPatterns) {
    output = applyBoldPatternOutsideExisting(output, pattern, 1);
  }
  return capBoldSegments(output, text);
}

export function boldRagAnswerHighYieldText(answer: RagAnswer, query: string): RagAnswer {
  return {
    ...answer,
    answer: boldHighYieldClinicalText(answer.answer, query),
    answerSections: answer.answerSections?.map((section) => ({
      ...section,
      body: boldHighYieldClinicalText(section.body, query),
    })),
  };
}
