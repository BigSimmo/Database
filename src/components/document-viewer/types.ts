// Row shapes for the document viewer's fetched detail payload (pages, images,
// table facts, chunks, full-document search hits, index health). Shared by the
// DocumentViewer container and its extracted presentation modules.

export type PageRow = {
  id: string;
  page_number: number;
  text: string;
  ocr_used: boolean;
};

export type ImageRow = {
  id: string;
  page_number: number | null;
  caption: string;
  image_type?: string | null;
  searchable?: boolean | null;
  clinical_relevance_score?: number | null;
  labels?: string[] | null;
  source_kind?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableTextSnippet?: string | null;
  clinicalUseClass?: string | null;
  clinicalUseReason?: string | null;
  accessibleTableMarkdown?: string | null;
  tableRows?: string[][] | null;
  tableColumns?: string[] | null;
  rowCount?: number | null;
  rowsTruncated?: boolean | null;
  columnCount?: number | null;
  width?: number | null;
  height?: number | null;
  cropCompleteness?: number | null;
  imageQualityScore?: number | null;
  ocrTextDensity?: number | null;
  structuredExtractionConfidence?: number | null;
  retainedForDocumentView?: boolean | null;
};

export type TableFactRow = {
  id: string;
  document_id: string;
  source_image_id: string | null;
  page_number: number | null;
  table_title: string | null;
  row_label: string | null;
  clinical_parameter: string | null;
  threshold_value: string | null;
  action: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ChunkRow = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids: string[];
  metadata?: Record<string, unknown> | null;
};

export type DocumentSearchResult = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  snippet: string;
  matched_terms: string[];
  image_ids: string[];
  score: number;
};

export type DocumentIndexHealth = {
  extractionQuality?: string | null;
  indexedAt?: string | null;
  indexVersion?: string | null;
  warnings?: unknown;
};
