import { classifyRagQuery, normalizedClinicalSearchTokens } from "@/lib/clinical-search";
import { isClinicalImageEvidence } from "@/lib/image-filtering";
import type { RagAnswer, RagQueryClass, SearchResult } from "@/lib/types";

const answerRankStrategy = "query_focused_answer_evidence_v1";

const answerBoilerplatePattern =
  /\b(?:uncontrolled when printed|document control|review date|version\s+\d|page\s+\d+\s+of\s+\d+|copyright|confidential)\b/i;

const queryTermExclusions = new Set([
  "recommended",
  "recommend",
  "summary",
  "summarize",
  "summarise",
  "overview",
  "information",
  "guidance",
  "approach",
  "therapy",
]);

const fixedHighYieldPatterns = [
  /\b(?:clozapine|lithium|ECT|FBC|ANC|myocarditis|neutropenia|metabolic|constipation|ECG)\b/gi,
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
  const contentText = `${result.content} ${imageEvidenceText(result)}`;
  return {
    title: normalizeText(titleText),
    section: normalizeText(sectionText),
    content: normalizeText(contentText),
    metadata: normalizeText(metadataText),
    adjacent: normalizeText(result.adjacent_context ?? ""),
    combined: normalizeText(`${titleText} ${sectionText} ${contentText} ${metadataText} ${result.adjacent_context ?? ""}`),
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

function phraseScore(query: string, haystack: string) {
  const queryTokens = uniqueQueryTokens(query);
  if (queryTokens.length < 2 || !haystack) return 0;
  const phrases: string[] = [];
  for (let size = Math.min(4, queryTokens.length); size >= 2; size -= 1) {
    for (let index = 0; index <= queryTokens.length - size; index += 1) {
      phrases.push(queryTokens.slice(index, index + size).join(" "));
    }
  }
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
    return /\b(?:dose|dosage|mg|mcg|route|oral|intramuscular|medication|antipsychotic|benzodiazepine|risk|toxicity|side effect|monitor)\b/i.test(
      combinedText,
    )
      ? 0.14
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
  if (metadata?.document_status === "current") score += 0.035;
  if (metadata?.document_status === "outdated") score -= 0.08;
  if (metadata?.clinical_validation_status === "approved") score += 0.035;
  if (metadata?.clinical_validation_status === "locally_reviewed") score += 0.02;
  if (metadata?.extraction_quality === "good") score += 0.035;
  if (metadata?.extraction_quality === "poor") score -= 0.06;
  return score;
}

function answerEvidenceScore(query: string, result: SearchResult, queryClass: RagQueryClass) {
  const texts = resultTexts(result);
  const tokens = uniqueQueryTokens(query);
  const base = Math.min(1, result.hybrid_score ?? result.similarity ?? 0) * 0.28;
  const contentCoverage = tokenCoverage(tokens, texts.content);
  const titleCoverage = tokenCoverage(tokens, texts.title);
  const sectionCoverage = tokenCoverage(tokens, texts.section);
  const metadataCoverage = tokenCoverage(tokens, texts.metadata);
  const combinedCoverage = tokenCoverage(tokens, texts.combined);
  const adjacentCoverage = tokenCoverage(tokens, texts.adjacent);
  const phraseCoverage = phraseScore(query, texts.combined);
  const directnessScore =
    contentCoverage * 0.34 + titleCoverage * 0.12 + sectionCoverage * 0.1 + metadataCoverage * 0.08;
  const weakOverlapPenalty = combinedCoverage < 0.2 ? -0.18 : combinedCoverage < 0.34 ? -0.07 : 0;
  const adjacentOnlyPenalty = contentCoverage < 0.16 && adjacentCoverage > contentCoverage ? -0.08 : 0;
  const boilerplatePenalty = answerBoilerplatePattern.test(result.content) && contentCoverage < 0.35 ? -0.08 : 0;

  return clampScore(
    base +
      directnessScore +
      phraseCoverage * 0.12 +
      classSignalScore(queryClass, result, texts.combined) +
      sourceQualityScore(result) +
      weakOverlapPenalty +
      adjacentOnlyPenalty +
      boilerplatePenalty,
  );
}

export function rankAnswerEvidence(
  query: string,
  results: SearchResult[],
  queryClass: RagQueryClass = classifyRagQuery(query).queryClass,
) {
  const ranked = results
    .map((result, index) => ({
      result,
      index,
      score: answerEvidenceScore(query, result, queryClass),
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryHighlightPatterns(query?: string) {
  if (!query) return [];
  const tokens = uniqueQueryTokens(query).filter((token) => token.length >= 4 && !queryTermExclusions.has(token));
  const patterns: RegExp[] = [];
  const normalizedQuery = normalizeText(query);
  const queryPhrase = tokens.length >= 2 ? tokens.join(" ") : "";
  if (queryPhrase && normalizedQuery.includes(queryPhrase)) {
    patterns.push(new RegExp(`\\b${escapeRegExp(queryPhrase).replace(/\\ /g, "\\s+")}\\b`, "gi"));
  }
  for (const token of tokens.slice(0, 6).sort((a, b) => b.length - a.length)) {
    patterns.push(new RegExp(`\\b${escapeRegExp(token)}\\w*\\b`, "gi"));
  }
  return patterns;
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

export function boldHighYieldClinicalText(text: string, query?: string) {
  if (!text.trim()) return text;
  if (query === undefined) return text;
  if (/[{}\[\]]/.test(text) && /"?(?:answer|heading|citation_chunk_ids|chunk_id)"?\s*:/i.test(text)) return text;
  let output = text;
  for (const pattern of [...queryHighlightPatterns(query), ...fixedHighYieldPatterns]) {
    output = applyBoldPatternOutsideExisting(output, pattern, 8);
  }
  return output;
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
