import { documentLabelReviewStatus } from "@/lib/document-tags";
import type {
  BestSourceRecommendation,
  Citation,
  ClinicalSourceMetadata,
  DocumentMatch,
  DocumentIndexQualityScore,
  DocumentLabel,
  QuoteCard,
  RelatedDocument,
  SmartPanel,
} from "@/lib/types";

type ClientFieldPolicy<T extends object> = {
  [Key in keyof T]-?: "client" | "server";
};

function projectFieldsForClient<T extends object>(value: T, policy: ClientFieldPolicy<T>): Partial<T> {
  return Object.fromEntries(
    (Object.keys(policy) as Array<keyof T>)
      .filter((key) => policy[key] === "client" && Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => [key, value[key]]),
  ) as Partial<T>;
}

const sourceMetadataFieldPolicy = {
  source_kind: "client",
  registry_record_kind: "client",
  registry_record_subkind: "client",
  registry_record_id: "client",
  registry_record_slug: "client",
  source_title: "client",
  publisher: "client",
  publisher_code: "client",
  jurisdiction: "client",
  version: "client",
  publication_date: "client",
  review_date: "client",
  uploaded_at: "client",
  indexed_at: "client",
  uploaded_by: "server",
  document_status: "client",
  clinical_validation_status: "client",
  clinical_validation_evidence: "server",
  extraction_quality: "client",
} as const satisfies ClientFieldPolicy<ClinicalSourceMetadata>;

const documentLabelFieldPolicy = {
  id: "client",
  document_id: "client",
  owner_id: "server",
  label: "client",
  label_type: "client",
  source: "client",
  confidence: "client",
  metadata: "server",
  created_at: "client",
  updated_at: "client",
} as const satisfies ClientFieldPolicy<DocumentLabel>;

const indexingQualityFieldPolicy = {
  document_id: "client",
  owner_id: "server",
  quality_score: "client",
  extraction_quality: "client",
  metrics: "server",
  issues: "client",
  updated_at: "client",
} as const satisfies ClientFieldPolicy<DocumentIndexQualityScore>;

const smartPanelFieldPolicy = {
  query: "client",
  total_sources: "client",
  documents: "client",
  quotes: "client",
  visualEvidence: "client",
  bestSource: "client",
  image_count: "client",
  evidenceSummary: "client",
  sourceCoverage: "client",
  conflictsOrGaps: "client",
  relatedDocuments: "client",
  relevance: "client",
} as const satisfies ClientFieldPolicy<SmartPanel>;

export function projectSourceMetadataForClient(
  metadata: ClinicalSourceMetadata | null | undefined,
): ClinicalSourceMetadata | null | undefined {
  if (metadata == null) return metadata;
  return {
    ...projectFieldsForClient(metadata, sourceMetadataFieldPolicy),
    // Keep the required server type honest without exposing the uploader UUID.
    uploaded_by: null,
  } as ClinicalSourceMetadata;
}

export function projectDocumentLabelForClient(label: DocumentLabel): DocumentLabel {
  return {
    ...projectFieldsForClient(label, documentLabelFieldPolicy),
    // The render layer needs this governance state, but not reviewer ids or
    // arbitrary label metadata.
    metadata: { review_status: documentLabelReviewStatus(label) },
  } as DocumentLabel;
}

export function projectDocumentLabelsForClient(labels: DocumentLabel[] | null | undefined): DocumentLabel[] {
  return (labels ?? [])
    .filter((label) => documentLabelReviewStatus(label) !== "hidden")
    .map(projectDocumentLabelForClient);
}

export function projectIndexingQualityForClient(
  quality: DocumentIndexQualityScore | null | undefined,
): DocumentIndexQualityScore | null | undefined {
  if (quality == null) return quality;
  return {
    ...projectFieldsForClient(quality, indexingQualityFieldPolicy),
    // Metrics are server diagnostics; an empty object preserves the required
    // type without exposing arbitrary nested values.
    metrics: {},
  } as DocumentIndexQualityScore;
}

export function projectCitationForClient(citation: Citation): Citation {
  return {
    chunk_id: citation.chunk_id,
    document_id: citation.document_id,
    title: citation.title,
    file_name: citation.file_name,
    page_number: citation.page_number,
    chunk_index: citation.chunk_index,
    ...(citation.similarity === undefined ? {} : { similarity: citation.similarity }),
    ...(citation.source_metadata === undefined
      ? {}
      : { source_metadata: projectSourceMetadataForClient(citation.source_metadata) }),
    ...(citation.provenance === undefined ? {} : { provenance: citation.provenance }),
  };
}

export function projectQuoteCardForClient(quote: QuoteCard): QuoteCard {
  return {
    ...projectCitationForClient(quote),
    quote: quote.quote,
    section_heading: quote.section_heading,
    ...(quote.source_strength === undefined ? {} : { source_strength: quote.source_strength }),
    ...(quote.isTruncated === undefined ? {} : { isTruncated: quote.isTruncated }),
  };
}

export function projectBestSourceForClient(source: BestSourceRecommendation): BestSourceRecommendation {
  return {
    ...projectCitationForClient(source),
    source_strength: source.source_strength,
    score: source.score,
    snippet: source.snippet,
    ...(source.quote === undefined ? {} : { quote: source.quote }),
    section_heading: source.section_heading,
    image_count: source.image_count,
    viewer_href: source.viewer_href,
    ...(source.relevance === undefined ? {} : { relevance: source.relevance }),
  };
}

function compactClientText(value: string | null | undefined, limit = 360): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 3).trimEnd()}...`;
}

function projectMatchReasonForClient(reason: string | null | undefined, labels: DocumentLabel[]) {
  if (!reason) return "Matched indexed passages";
  const labelMatch = /^Matched label:\s*(.+)$/i.exec(reason.trim());
  if (!labelMatch) return reason;
  const matchedLabel = labelMatch[1].trim().toLowerCase();
  return labels.some((label) => label.label.trim().toLowerCase() === matchedLabel)
    ? reason
    : "Matched indexed passages";
}

export function projectRelatedDocumentForClient(document: RelatedDocument): RelatedDocument {
  const labels = projectDocumentLabelsForClient(document.labels);
  return {
    document_id: document.document_id,
    title: document.title,
    file_name: document.file_name,
    labels,
    summary: compactClientText(document.summary),
    best_pages: Array.isArray(document.best_pages) ? document.best_pages.slice(0, 5) : [],
    best_chunk_ids: Array.isArray(document.best_chunk_ids) ? document.best_chunk_ids.slice(0, 5) : [],
    image_count: document.image_count,
    ...(document.table_count === undefined ? {} : { table_count: document.table_count }),
    match_reason: projectMatchReasonForClient(document.match_reason, labels),
    score: document.score,
  };
}

export function projectDocumentMatchForClient(document: DocumentMatch): DocumentMatch {
  const labels = projectDocumentLabelsForClient(document.labels);
  return {
    document_id: document.document_id,
    title: document.title,
    file_name: document.file_name,
    labels,
    summarySnippet: compactClientText(document.summarySnippet),
    bestPages: Array.isArray(document.bestPages) ? document.bestPages.slice(0, 5) : [],
    bestChunkIds: Array.isArray(document.bestChunkIds) ? document.bestChunkIds.slice(0, 5) : [],
    imageCount: document.imageCount,
    tableCount: document.tableCount,
    matchReason: projectMatchReasonForClient(document.matchReason, labels),
    score: document.score,
    ...(document.relevance === undefined ? {} : { relevance: document.relevance }),
  };
}

export function projectSmartPanelForClient(panel: SmartPanel): SmartPanel {
  const projected = projectFieldsForClient(panel, smartPanelFieldPolicy) as SmartPanel;
  return {
    ...projected,
    // Older cached/demo payloads and focused route mocks may omit fields that
    // are required by the current type. Treat absent evidence as empty rather
    // than failing the whole search response at the browser boundary.
    quotes: Array.isArray(panel.quotes) ? panel.quotes.map(projectQuoteCardForClient) : [],
    ...(panel.bestSource === undefined
      ? {}
      : { bestSource: panel.bestSource ? projectBestSourceForClient(panel.bestSource) : null }),
    ...(panel.relatedDocuments === undefined
      ? {}
      : {
          relatedDocuments: Array.isArray(panel.relatedDocuments)
            ? panel.relatedDocuments.map(projectRelatedDocumentForClient)
            : [],
        }),
  };
}
