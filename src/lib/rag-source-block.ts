import { isClinicalImageEvidence } from "@/lib/image-filtering";
import { metadataText, safeRecord } from "@/lib/rag-answer-text";
import { fenceSourceEvidence, neutralizePromptInstructions, sourceTextForModel } from "@/lib/source-text-sanitizer";
import type { RagQueryClass, SearchResult } from "@/lib/types";

// Boundary-aware, number-safe truncation for text handed to the model (P7). A naive char-boundary
// cut splits sentences and numbers (e.g. "150 mg" -> "...15"), feeding the model clipped clinical
// facts. Prefer the last sentence boundary that still keeps most of the budget (end cleanly, no
// ellipsis); otherwise cut on a word boundary and never strand a bare number whose unit/context was
// cut off, so a dose or threshold can never be presented as a truncated figure.
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

export function compactContextText(text: string, limit: number) {
  const compact = sourceTextForModel(text).replace(/\s+/g, " ").trim();
  return truncateForModel(compact, limit);
}

type RagSourceBlockOptions = {
  query?: string;
  queryClass?: RagQueryClass;
};

function richTableSourceContextEnabled(options?: RagSourceBlockOptions) {
  return options?.queryClass === "table_threshold" || options?.queryClass === "medication_dose_risk";
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
  return compactContextText(neutralizePromptInstructions(snippet), 420);
}

function formatTableFactForSourceBlock(
  result: SearchResult,
  fact: NonNullable<SearchResult["table_facts"]>[number],
  rich: boolean,
) {
  if (!rich) {
    return compactContextText(
      neutralizePromptInstructions(
        [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
          .filter(Boolean)
          .join(" | "),
      ),
      360,
    );
  }

  const snippet = tableSnippetForFact(result, fact);
  return compactContextText(
    neutralizePromptInstructions(
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
    ),
    760,
  );
}

export function buildRagSourceBlock(results: SearchResult[], options?: RagSourceBlockOptions) {
  const richTableContext = richTableSourceContextEnabled(options);
  return results
    .map((result, index) => {
      const page = result.page_number ? `page ${result.page_number}` : "page unavailable";
      const searchableImages = result.images?.filter((image) => isClinicalImageEvidence(image));
      const images = searchableImages?.length
        ? `\nImages: ${searchableImages
            .map((image) =>
              [
                image.tableLabel,
                image.tableTitle,
                image.caption,
                image.tableTextSnippet
                  ? `Table text: ${compactContextText(neutralizePromptInstructions(image.tableTextSnippet), 320)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" - "),
            )
            .join(" | ")}`
        : "";
      const adjacentContext = result.adjacent_context
        ? `\nNearby context from the same source: ${compactContextText(neutralizePromptInstructions(result.adjacent_context), 900)}`
        : "";
      const sectionPath = result.section_path?.length
        ? `\nSection path: ${neutralizePromptInstructions(result.section_path.join(" > "))}`
        : result.section_heading
          ? `\nSection: ${neutralizePromptInstructions(result.section_heading)}`
          : "";
      const tableFacts = result.table_facts?.length
        ? `\nStructured table facts: ${result.table_facts
            .slice(0, richTableContext ? 3 : 4)
            .map((fact) => formatTableFactForSourceBlock(result, fact, richTableContext))
            .filter(Boolean)
            .join(" ; ")}`
        : "";
      const indexWarnings = result.indexing_quality?.issues?.length
        ? `\nIndex quality warnings: ${result.indexing_quality.issues.slice(0, 3).join("; ")}`
        : "";
      const memoryCards = result.memory_cards?.length
        ? `\nStructured memory: ${result.memory_cards
            .slice(0, 3)
            .map((card) => `${card.card_type}: ${compactContextText(neutralizePromptInstructions(card.content), 300)}`)
            .join(" | ")}`
        : "";
      const retrievalSynopsis = result.retrieval_synopsis
        ? `\nRetrieval synopsis: ${compactContextText(neutralizePromptInstructions(result.retrieval_synopsis), 700)}`
        : "";
      const neutralizedContent = neutralizePromptInstructions(result.content);
      const fencedContent = fenceSourceEvidence(compactContextText(neutralizedContent, 1800));
      return [
        [
          `[${index + 1}] ${result.title} (${result.file_name}, ${page}, chunk ${result.chunk_index}, similarity ${result.similarity.toFixed(3)})`,
          `citation_chunk_id: ${result.id}`,
          `document_id: ${result.document_id}`,
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
}
