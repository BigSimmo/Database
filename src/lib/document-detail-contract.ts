import type { ClinicalDocument } from "@/lib/types";

export type DocumentAssetScope = "document" | "window";

export type DocumentDetailPage = {
  id: string;
  page_number: number;
  text: string;
  ocr_used: boolean;
  metadata?: Record<string, unknown> | null;
};

export type DocumentDetailImage = {
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

export type DocumentDetailTableFact = {
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

export type DocumentDetailChunk = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids: string[];
  metadata?: Record<string, unknown> | null;
};

export type DocumentDetailIndexHealth = {
  extractionQuality?: string | null;
  indexedAt?: string | null;
  indexVersion?: string | null;
  warnings?: unknown;
};

export type DocumentPageWindow = {
  from: number;
  to: number;
  limit: number;
  total: number | null;
  hasBefore: boolean;
  hasAfter: boolean;
};

export type DocumentChunkWindow = {
  offset: number;
  limit: number;
  total: number | null;
  hasBefore: boolean;
  hasAfter: boolean;
  selectedChunkId: string | null;
};

export type DocumentDetailPayload = {
  document: ClinicalDocument;
  pages: DocumentDetailPage[];
  images: DocumentDetailImage[];
  tableFacts: DocumentDetailTableFact[];
  chunks: DocumentDetailChunk[];
  indexHealth?: DocumentDetailIndexHealth;
  demoMode: boolean;
  assetScope: DocumentAssetScope;
  window: {
    requestedPage: number;
    effectivePage: number;
    selectedChunkId: string | null;
    pages: DocumentPageWindow;
    chunks: DocumentChunkWindow;
  };
  pageWindow: DocumentPageWindow;
  chunkWindow: DocumentChunkWindow;
};
