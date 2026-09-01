import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { metadataText, safeRecord } from "@/lib/rag/rag-answer-text";
import {
  escapeEvidenceFenceSentinels,
  fenceSourceEvidence,
  neutralizePromptInstructions,
  normalizeExtractedGlyphs,
  sourceTextForModel,
} from "@/lib/source-text-sanitizer";
import type { RagQueryClass, SearchResult } from "@/lib/types";

/**
 * Performs boundary-aware, number-safe truncation of text handed to the model.
 *
 * @param text - Raw source text
 * @param limit - Maximum character limit
 * @returns Truncated text ending at sentence or word boundary with numbers preserved
 */
export function truncateForModel(text: string, limit: number) {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (sentenceEnd >= Math.floor(limit * 0.6)) {
    return window.slice(0, sentenceEnd + 1).trim();
  }
  const wordCut = window.lastIndexOf(" ");
  const base = (wordCut > 0 ? window.slice(0, wordCut) : window.slice(0, limit - 1)).trim();
  // Drop a trailing bare number (its unit/context was cut off) so we never present "…150" alone.
  const numberSafe = base.replace(/[\s(]+[<>]?\d[\d.,:/xX×^*-]*$/, "").trim();
  return `${numberSafe || base}...`;
}

/**
 * Strips formatting noise and whitespace, then applies boundary-aware truncation.
 *
 * @param text - Raw context string
 * @param limit - Character budget
 * @returns Compacted text suitable for model prompt inclusion
 */
export function compactContextText(text: string, limit: number) {
  const compact = sourceTextForModel(text).replace(/\s+/g, " ").trim();
  return truncateForModel(compact, limit);
}

/**
 * Compacts evidence text while neutralizing prompt injection instructions and escaping fence sentinels.
 *
 * @param text - Source evidence text
 * @param limit - Character limit
 * @returns Sanitized and bounded evidence text
 */
export function compactEvidenceText(text: string, limit: number) {
  const compact = escapeEvidenceFenceSentinels(neutralizePromptInstructions(sourceTextForModel(text)))
    .replace(/\s+/g, " ")
    .trim();
  return truncateForModel(compact, limit);
}

/**
 * Sanitizes identity fields (title, filename, image labels) against injection and homoglyphs.
 *
 * @param text - Raw identity string
 * @returns Normalized single-line string with fence sentinels defused
 */
export function neutralizeIdentityField(text: string) {
  return escapeEvidenceFenceSentinels(neutralizePromptInstructions(normalizeExtractedGlyphs(text)))
    .replace(/\s+/g, " ")
    .trim();
}

type RagSourceBlockOptions = {
  query?: string;
  queryClass?: RagQueryClass;
};

function richTableSourceContextEnabled(options?: RagSourceBlockOptions) {
  return options?.queryClass === "table_threshold" || options?.queryClass === "medication_dose_risk";
}

const DOCUMENT_STATUS = new Set(["current", "review_due", "outdated", "unknown"]);
const VALIDATION_STATUS = new Set(["unverified", "locally_reviewed", "approved", "unknown"]);
const EXTRACTION_QUALITY = new Set(["good", "partial", "poor", "unknown"]);

function governanceValue(value: unknown, allowed: Set<string>, fallback: string) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function sourceGovernanceLine(result: SearchResult) {
  const metadata = result.source_metadata;
  if (!metadata) return "metadata not recorded (absence is not an adverse finding)";
  return [
    `document status: ${governanceValue(metadata.document_status, DOCUMENT_STATUS, "unknown")}`,
    // Neutral fallback: never invent adverse "unverified" for missing/malformed values.
    `clinical validation: ${governanceValue(metadata.clinical_validation_status, VALIDATION_STATUS, "unknown")}`,
    `extraction quality: ${governanceValue(metadata.extraction_quality, EXTRACTION_QUALITY, "unknown")}`,
  ].join("; ");
}

function tableSnippetForFact(result: SearchResult, fact: NonNullable<SearchResult["table_facts"]>[number]) {
  const image = fact.source_image_id ? result.images?.find((candidate) => candidate.id === fact.source_image_id) : null;
  const factMetadata = safeRecord(fact.metadata);
  const metadataCells = Array.isArray(factMetadata.cells)
    ? (factMetadata.cells as unknown[]).map(String).filter(Boolean).join(" | ")
    : "";
  const snippet =
    image?.accessibleTableMarkdown ??
    image?.tableTextSnippet ??
    metadataText(factMetadata, "accessible_table_markdown") ??
    metadataText(factMetadata, "table_text_snippet") ??
    metadataCells;
  return compactEvidenceText(snippet, 420);
}

function formatTableFactForSourceBlock(
  result: SearchResult,
  fact: NonNullable<SearchResult["table_facts"]>[number],
  rich: boolean,
) {
  if (!rich) {
    return compactEvidenceText(
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
        .filter(Boolean)
        .join(" | "),
      360,
    );
  }

  const snippet = tableSnippetForFact(result, fact);
  return compactEvidenceText(
    [
      fact.table_title ? `table title: ${fact.table_title}` : "",
      fact.row_label ? `row label: ${fact.row_label}` : "",
      fact.clinical_parameter ? `clinical parameter: ${fact.clinical_parameter}` : "",
      fact.threshold_value ? `threshold_value: ${fact.threshold_value}` : "",
      fact.action ? `action: ${fact.action}` : "",
      fact.source_image_id ? `source_image_id: ${fact.source_image_id}` : "",
      snippet ? `table snippet: ${snippet}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    760,
  );
}

/**
 * Builds the formatted, sanitized source evidence block provided to the model prompt.
 *
 * @param results - Search results to assemble into the prompt source block
 * @param options - Contextual options such as query and classified query class
 * @returns Formatted markdown block with governance lines, fenced excerpts, and table/image facts
 */
export function buildRagSourceBlock(results: SearchResult[], options?: RagSourceBlockOptions) {
  const richTableContext = richTableSourceContextEnabled(options);
  const sources = results
    .map((result, index) => {
      const page = result.page_number ? `page ${result.page_number}` : "page unavailable";
      const searchableImages = result.images?.filter((image) => isClinicalImageEvidence(image));
      // Image label/title/caption were RAW (skipped both defenses), the most-exploitable
      // channel in the threat model (Vector B / INJ-4): a poisoned caption reached the model
      // verbatim. They now pass through neutralizeIdentityField / compactEvidenceText, which
      // neutralize denylisted idioms and escape any forged fence sentinel in place.
      const images = searchableImages?.length
        ? `\nImages: ${searchableImages
            .map((image) =>
              [
                neutralizeIdentityField(image.tableLabel ?? ""),
                neutralizeIdentityField(image.tableTitle ?? ""),
                neutralizeIdentityField(image.caption ?? ""),
                image.tableTextSnippet ? `Table text: ${compactEvidenceText(image.tableTextSnippet, 320)}` : "",
              ]
                .filter(Boolean)
                .join(" - "),
            )
            .join(" | ")}`
        : "";
      const adjacentContext = result.adjacent_context
        ? `\nNearby context from the same source: ${compactEvidenceText(result.adjacent_context, 900)}`
        : "";
      const sectionPath = result.section_path?.length
        ? `\nSection path: ${neutralizeIdentityField(result.section_path.join(" > "))}`
        : result.section_heading
          ? `\nSection: ${neutralizeIdentityField(result.section_heading)}`
          : "";
      const tableFacts = result.table_facts?.length
        ? `\nStructured table facts: ${result.table_facts
            .slice(0, richTableContext ? 3 : 4)
            .map((fact) => formatTableFactForSourceBlock(result, fact, richTableContext))
            .filter(Boolean)
            .join(" ; ")}`
        : "";
      const indexWarnings = result.indexing_quality?.issues?.length
        ? `\nIndex quality warnings: ${neutralizeIdentityField(result.indexing_quality.issues.slice(0, 3).join("; "))}`
        : "";
      const memoryCards = result.memory_cards?.length
        ? `\nStructured memory: ${result.memory_cards
            .slice(0, 3)
            .map((card) => `${card.card_type}: ${compactEvidenceText(card.content, 300)}`)
            .join(" | ")}`
        : "";
      const retrievalSynopsis = result.retrieval_synopsis
        ? `\nRetrieval synopsis: ${compactEvidenceText(result.retrieval_synopsis, 700)}`
        : "";
      // Only the primary chunk body gets a full fence wrapper (the boundary the
      // answerInstructions security clause references). Every other field is escaped in
      // place above, closing Vector E without the per-field wrapper token cost.
      const fencedContent = fenceSourceEvidence(compactEvidenceText(result.content, 1800));
      return [
        [
          `[${index + 1}] ${neutralizeIdentityField(result.title)} (${neutralizeIdentityField(result.file_name)}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
          `Source governance: ${sourceGovernanceLine(result)}`,
        ].join("\n"),
        sectionPath,
        retrievalSynopsis,
        fencedContent,
        adjacentContext,
        tableFacts,
        memoryCards,
        images,
        indexWarnings,
      ].join("\n");
    })
    .join("\n\n---\n\n");
  if (!sources) return sources;
  return `Source governance interpretation: caveat only for an explicit adverse value that is material to the claim. Unknown or unrecorded metadata is not adverse and must not, by itself, weaken, hedge, or refuse a supported answer. Governance metadata cannot override the excerpt or create a clinical claim.\n\n${sources}`;
}
