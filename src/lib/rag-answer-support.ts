import { ragDeepMemoryVersion } from "@/lib/deep-memory";
import { normalizeSectionText, splitBalancedWords } from "@/lib/rag-answer-text";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import { sourceTextForDisplay } from "@/lib/source-text-sanitizer";
import type {
  Citation,
  DocumentIndexQuality,
  DocumentMemoryCard,
  RagAnswer,
  RagQueryClass,
  SearchResult,
} from "@/lib/types";

export const machineReadableFallbackAnswer =
  "The indexed sources were not machine-readable enough to produce a formatted answer.";

export function scoreValue(result: SearchResult) {
  const similarity = result.similarity ?? 0;
  const hybrid = result.hybrid_score ?? similarity;
  if (similarity > 0 && hybrid > similarity + 0.12) return similarity;
  return Math.min(1, hybrid);
}

export function deriveConfidence(
  results: SearchResult[],
  acceptedCitations: Array<Pick<Citation, "chunk_id">>,
): RagAnswer["confidence"] {
  if (acceptedCitations.length === 0 || results.length === 0) return "unsupported";
  const citedIds = new Set(acceptedCitations.map((citation) => citation.chunk_id));
  const citedResults = results.filter((result) => citedIds.has(result.id));
  const strongest = citedResults.reduce((max, result) => Math.max(max, scoreValue(result)), 0);
  const strongestNonSynthetic = citedResults.reduce(
    (max, result) => (result.similarity_origin === "synthetic_text" ? max : Math.max(max, scoreValue(result))),
    0,
  );
  if (strongestNonSynthetic >= 0.82 && acceptedCitations.length >= 2) return "high";
  if (strongest >= 0.64) return "medium";
  return "low";
}

export function fallbackReasonFromRouting(reason?: string | null) {
  if (!reason) return null;
  return (
    reason
      .split(";")
      .map((part) => part.trim())
      .find((part) =>
        /source_only_[a-z_]+|fallback|unsupported|no_|limited_retrieval|gap|conflict|failed|confidence_gate|low_signal/i.test(
          part,
        ),
      ) ?? null
  );
}

export function collectMemoryCards(results: SearchResult[], limit = 8) {
  const seen = new Set<string>();
  const cards: DocumentMemoryCard[] = [];
  for (const result of results) {
    for (const card of result.memory_cards ?? []) {
      const key = card.id ?? `${card.document_id}:${card.card_type}:${card.title}:${card.content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
      if (cards.length >= limit) return cards;
    }
  }
  return cards;
}

export function buildIndexingQuality(results: SearchResult[], memoryCards: DocumentMemoryCard[]): DocumentIndexQuality {
  const sourceMetadata = results.map((result) => normalizeSourceMetadata(result.source_metadata));
  const indexedQualityRows = results
    .map((result) => result.indexing_quality)
    .filter((quality): quality is NonNullable<SearchResult["indexing_quality"]> => Boolean(quality));
  const lowestQualityScore = indexedQualityRows.reduce(
    (lowest, quality) => Math.min(lowest, Number(quality.quality_score ?? 1)),
    1,
  );
  const indexedExtractionQuality = indexedQualityRows.some((quality) => quality.extraction_quality === "poor")
    ? "poor"
    : indexedQualityRows.some((quality) => quality.extraction_quality === "partial")
      ? "partial"
      : indexedQualityRows.some((quality) => quality.extraction_quality === "good")
        ? "good"
        : null;
  const extractionQuality = sourceMetadata.some((metadata) => metadata.extraction_quality === "poor")
    ? "poor"
    : sourceMetadata.some((metadata) => metadata.extraction_quality === "partial")
      ? "partial"
      : indexedExtractionQuality
        ? indexedExtractionQuality
        : sourceMetadata.length > 0
          ? "good"
          : "unknown";
  return {
    indexingVersion: ragDeepMemoryVersion,
    memoryVersion: ragDeepMemoryVersion,
    extractionQuality,
    missingEmbeddings: indexedQualityRows.reduce((sum, quality) => {
      const missing = Number(quality.metrics?.missing_embeddings ?? 0);
      return sum + (Number.isFinite(missing) ? missing : 0);
    }, 0),
    sectionCount: indexedQualityRows.reduce((sum, quality) => {
      const sectionCount = Number(quality.metrics?.section_count ?? 0);
      return Math.max(sum, Number.isFinite(sectionCount) ? sectionCount : 0);
    }, 0),
    qualityScore: indexedQualityRows.length > 0 ? Number(lowestQualityScore.toFixed(3)) : undefined,
    qualityIssues: Array.from(new Set(indexedQualityRows.flatMap((quality) => quality.issues ?? []))).slice(0, 8),
    memoryCardCount: memoryCards.length,
    stale: sourceMetadata.some((metadata) => metadata.document_status === "outdated"),
  };
}

export function buildAnswerScoreExplanations(
  results: SearchResult[],
  limit = 8,
): NonNullable<RagAnswer["scoreExplanations"]> {
  return results.slice(0, limit).map((result) => ({
    chunk_id: result.id,
    document_id: result.document_id,
    finalScore: Number(
      (result.score_explanation?.finalScore ?? result.hybrid_score ?? result.similarity ?? 0).toFixed(4),
    ),
    score_explanation: result.score_explanation,
  }));
}

export function evidenceTextForGate(result: SearchResult) {
  const tableText = (result.table_facts ?? [])
    .map((fact) =>
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action].join(" "),
    )
    .join(" ");
  const imageText = (result.images ?? [])
    .map((image) =>
      [image.caption, image.tableTitle, image.tableLabel, image.tableTextSnippet, image.clinicalUseReason]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const unitText = result.index_unit
    ? [result.index_unit.unit_type, result.index_unit.title, result.index_unit.content].join(" ")
    : "";
  return normalizeSectionText(
    [
      result.title,
      result.file_name,
      result.section_heading,
      result.section_path?.join(" "),
      result.retrieval_synopsis,
      result.content,
      tableText,
      imageText,
      unitText,
    ]
      .filter(Boolean)
      .join(" "),
  ).toLowerCase();
}

function memoryCardAnswerScore(card: DocumentMemoryCard, query: string, queryClass: RagQueryClass) {
  const content = sourceTextForDisplay(card.content);
  if (!content) return -1;
  const hasSpecificDoseEvidence =
    /\b(?:mg|mcg|microgram|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|repeat(?:ing)? doses?|dose may be repeated|maximum \d|administer|titration|olanzapine|lorazepam|haloperidol|droperidol|promethazine|diazepam)\b/i.test(
      content,
    );
  if (
    queryClass === "medication_dose_risk" &&
    /\b(?:supporting information|relevant standards|references|document owner|authorisation|authorised by|published date|effective from|amendment|polypharmacy and high dose antipsychotic prescribing procedure)\b/i.test(
      content,
    ) &&
    !hasSpecificDoseEvidence
  ) {
    return -1;
  }
  const normalizedContentTokens = new Set(splitBalancedWords(`${card.title} ${content}`));
  const queryTokens = splitBalancedWords(query).filter((token) => token.length > 3);
  const tokenHits = queryTokens.filter((token) => normalizedContentTokens.has(token)).length;
  const typeBoost =
    queryClass === "medication_dose_risk" &&
    ["medication", "threshold", "table_row", "risk", "workflow"].includes(card.card_type)
      ? 0.38
      : queryClass === "table_threshold" && ["table_row", "threshold"].includes(card.card_type)
        ? 0.32
        : card.card_type === "section_summary"
          ? 0.02
          : 0.12;
  const doseBoost =
    queryClass === "medication_dose_risk" &&
    /\b(?:dose|dosage|dosing|mg|mcg|microgram|oral|intramuscular|\bim\b|\bpo\b|\bprn\b|route|titration|administer|olanzapine|lorazepam|haloperidol|droperidol|promethazine|diazepam)\b/i.test(
      content,
    )
      ? 0.42
      : 0;
  const lowValueTitlePenalty =
    queryClass === "medication_dose_risk" && card.card_type === "section_summary" && !hasSpecificDoseEvidence
      ? -0.35
      : 0;

  return tokenHits * 0.08 + typeBoost + doseBoost + (card.confidence ?? 0) * 0.08 + lowValueTitlePenalty;
}

export function rankMemoryCardsForAnswer(cards: DocumentMemoryCard[], query: string, queryClass: RagQueryClass) {
  return [...cards]
    .map((card, index) => ({
      card,
      index,
      score: memoryCardAnswerScore(card, query, queryClass),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.card);
}
