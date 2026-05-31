export type DocumentStatus = "queued" | "processing" | "indexed" | "failed";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type ImportBatchStatus = "queued" | "processing" | "completed" | "completed_with_errors" | "failed";

export type ImageEvidenceCategory =
  | "clinical_table"
  | "flowchart_algorithm"
  | "form_checklist"
  | "risk_matrix"
  | "medication_chart"
  | "graph"
  | "screenshot_ui"
  | "cover_page"
  | "photo"
  | "logo_decorative"
  | "unclear";

export type ClinicalImageUseClass =
  | "clinical_evidence"
  | "administrative"
  | "reference"
  | "decorative_or_empty"
  | "ambiguous";

export type DocumentLabelType =
  | "topic"
  | "document_type"
  | "medication"
  | "risk"
  | "setting"
  | "workflow"
  | "population"
  | "service"
  | "custom";

export type ClinicalSourceMetadata = {
  source_title: string | null;
  publisher: string | null;
  jurisdiction: string | null;
  version: string | null;
  publication_date: string | null;
  review_date: string | null;
  uploaded_at: string | null;
  indexed_at: string | null;
  uploaded_by: string | null;
  document_status: "current" | "review_due" | "outdated" | "unknown";
  clinical_validation_status: "unverified" | "locally_reviewed" | "approved";
  extraction_quality: "good" | "partial" | "poor" | "unknown";
};

export type ClinicalDocument = {
  id: string;
  owner_id?: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  content_hash?: string | null;
  source_path?: string | null;
  import_batch_id?: string | null;
  status: DocumentStatus;
  page_count: number;
  chunk_count: number;
  image_count: number;
  error_message: string | null;
  metadata?: Record<string, unknown> | ClinicalSourceMetadata | null;
  labels?: DocumentLabel[];
  summary?: DocumentSummary | null;
  created_at: string;
  updated_at: string;
};

export type IngestionJob = {
  id: string;
  document_id: string;
  batch_id?: string | null;
  status: JobStatus;
  stage: string;
  progress: number;
  error_message: string | null;
  attempt_count?: number;
  max_attempts?: number;
  locked_at?: string | null;
  locked_by?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
  documents?: Pick<ClinicalDocument, "title" | "file_name" | "status"> | null;
};

export type ImportBatch = {
  id: string;
  owner_id: string | null;
  name: string;
  source_root: string | null;
  include_glob: string;
  status: ImportBatchStatus;
  total_files: number;
  queued_files: number;
  skipped_files: number;
  failed_files: number;
  total_bytes: number;
  metadata: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChunkImage = {
  id: string;
  page_number: number | null;
  storage_path: string;
  signed_url?: string;
  caption: string;
  bbox?: unknown;
  image_type?: ImageEvidenceCategory;
  searchable?: boolean;
  clinical_relevance_score?: number;
  source_kind?: string | null;
  sourceKind?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableTextSnippet?: string | null;
  clinicalUseClass?: ClinicalImageUseClass | null;
  clinicalUseReason?: string | null;
  accessibleTableMarkdown?: string | null;
  tableRows?: string[][] | null;
  tableColumns?: string[] | null;
  labels?: string[];
  metadata?: Record<string, unknown> | null;
};

export type SearchResult = {
  id: string;
  document_id: string;
  title: string;
  file_name: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids: string[];
  similarity: number;
  text_rank?: number;
  hybrid_score?: number;
  source_strength?: SourceStrength;
  source_metadata?: ClinicalSourceMetadata | null;
  document_labels?: DocumentLabel[];
  document_summary?: string | null;
  adjacent_context?: string | null;
  memory_cards?: DocumentMemoryCard[];
  memory_score?: number;
  images: ChunkImage[];
};

export type Citation = {
  chunk_id: string;
  document_id: string;
  title: string;
  file_name: string;
  page_number: number | null;
  chunk_index: number;
  similarity?: number;
  source_metadata?: ClinicalSourceMetadata | null;
};

export type QuoteCard = Citation & {
  quote: string;
  section_heading: string | null;
  source_strength?: SourceStrength;
};

export type SourceStrength = "strong" | "moderate" | "limited";

export type VisualEvidenceCard = {
  id: string;
  image_id: string;
  signed_url_endpoint: string;
  caption: string;
  document_id: string;
  title: string;
  file_name: string;
  page_number: number | null;
  source_chunk_id: string;
  chunk_index: number;
  viewer_href: string;
  image_type?: ImageEvidenceCategory;
  clinical_relevance_score?: number;
  source_kind?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableTextSnippet?: string | null;
  clinicalUseClass?: ClinicalImageUseClass | null;
  clinicalUseReason?: string | null;
  accessibleTableMarkdown?: string | null;
  tableRows?: string[][] | null;
  tableColumns?: string[] | null;
  labels?: string[];
};

export type DocumentLabel = {
  id: string;
  document_id: string;
  owner_id?: string | null;
  label: string;
  label_type: DocumentLabelType;
  source: "generated" | "manual";
  confidence: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type DocumentSummary = {
  id: string;
  document_id: string;
  owner_id?: string | null;
  summary: string;
  clinical_specifics: {
    actions?: string[];
    thresholds_timing?: string[];
    medication_monitoring?: string[];
    risk_escalation?: string[];
    documentation_forms?: string[];
    exceptions_gaps?: string[];
    [key: string]: unknown;
  };
  source_chunk_ids: string[];
  source_image_ids: string[];
  model: string | null;
  metadata?: Record<string, unknown>;
  generated_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type RagIndexingVersion = "rag-universal-v1" | "rag-deep-memory-v1";

export type DocumentIndexQuality = {
  indexingVersion?: RagIndexingVersion | string | null;
  memoryVersion?: RagIndexingVersion | string | null;
  extractionQuality?: ClinicalSourceMetadata["extraction_quality"];
  sectionCount?: number;
  memoryCardCount?: number;
  missingEmbeddings?: number;
  stale?: boolean;
};

export type DocumentSectionMemory = {
  id?: string;
  document_id: string;
  owner_id?: string | null;
  section_index: number;
  heading: string;
  heading_path: string[];
  page_start: number | null;
  page_end: number | null;
  chunk_ids: string[];
  summary: string;
  tags: string[];
  extraction_quality: ClinicalSourceMetadata["extraction_quality"];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type DocumentMemoryCardType =
  | "section_summary"
  | "table_row"
  | "threshold"
  | "medication"
  | "risk"
  | "workflow"
  | "definition"
  | "citation_anchor";

export type DocumentMemoryCard = {
  id?: string;
  document_id: string;
  owner_id?: string | null;
  section_id?: string | null;
  card_type: DocumentMemoryCardType;
  title: string;
  content: string;
  normalized_terms: string[];
  page_number: number | null;
  source_chunk_ids: string[];
  source_image_ids: string[];
  confidence: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  created_at?: string;
  updated_at?: string;
};

export type RagQueryClass =
  | "document_lookup"
  | "table_threshold"
  | "medication_dose_risk"
  | "comparison"
  | "broad_summary"
  | "unsupported_or_general";

export type RelatedDocument = {
  document_id: string;
  title: string;
  file_name: string;
  labels: DocumentLabel[];
  summary: string | null;
  best_pages: number[];
  best_chunk_ids: string[];
  image_count: number;
  table_count?: number;
  match_reason: string;
  score: number;
};

export type DocumentMatch = {
  document_id: string;
  title: string;
  file_name: string;
  labels: DocumentLabel[];
  summarySnippet: string | null;
  bestPages: number[];
  bestChunkIds: string[];
  imageCount: number;
  tableCount: number;
  matchReason: string;
  score: number;
};

export type DocumentBreakdown = {
  document_id: string;
  title: string;
  file_name: string;
  top_similarity: number;
  source_strength: SourceStrength;
  source_count: number;
  quote_count: number;
  pages: number[];
  best_quote?: string;
};

export type BestSourceRecommendation = Citation & {
  source_strength: SourceStrength;
  score: number;
  snippet: string;
  quote?: string;
  section_heading: string | null;
  image_count: number;
  viewer_href: string;
};

export type EvidenceSummary = {
  document_count: number;
  total_sources: number;
  quote_count: number;
  image_count: number;
  source_strength: SourceStrength | "none";
  summary: string;
};

export type SourceCoverage = {
  documents_used: number;
  pages: number[];
  strongest_similarity: number;
  has_images: boolean;
};

export type ConflictOrGap = {
  type: "gap" | "conflict";
  message: string;
  source_chunk_ids?: string[];
};

export type AnswerSection = {
  heading: string;
  body: string;
  citation_chunk_ids: string[];
};

export type OpenAITokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  reasoning_output_tokens?: number;
};

export type SmartPanel = {
  query: string;
  total_sources: number;
  documents: DocumentBreakdown[];
  quotes: QuoteCard[];
  visualEvidence: VisualEvidenceCard[];
  bestSource?: BestSourceRecommendation | null;
  image_count: number;
  evidenceSummary: EvidenceSummary;
  sourceCoverage: SourceCoverage;
  conflictsOrGaps: ConflictOrGap[];
  relatedDocuments?: RelatedDocument[];
};

export type RagAnswer = {
  answer: string;
  grounded: boolean;
  confidence: "high" | "medium" | "low" | "unsupported";
  citations: Citation[];
  sources: SearchResult[];
  modelUsed?: string | null;
  routingMode?: "unsupported" | "extractive" | "fast" | "strong";
  routingReason?: string;
  queryClass?: RagQueryClass;
  latencyTimings?: {
    search_cache_hit?: boolean;
    text_fast_path_latency_ms?: number;
    embedding_skipped?: boolean;
    embedding_latency_ms?: number;
    embedding_cache_hit?: boolean;
    supabase_rpc_latency_ms?: number;
    rerank_latency_ms?: number;
    context_pack_latency_ms?: number;
    search_latency_ms?: number;
    generation_latency_ms?: number;
    total_latency_ms?: number;
  };
  openAIRequestIds?: string[];
  openAIUsage?: OpenAITokenUsage;
  answerSections?: AnswerSection[];
  evidenceSummary?: EvidenceSummary;
  conflictsOrGaps?: ConflictOrGap[];
  sourceCoverage?: SourceCoverage;
  quoteCards?: QuoteCard[];
  visualEvidence?: VisualEvidenceCard[];
  bestSource?: BestSourceRecommendation | null;
  documentBreakdown?: DocumentBreakdown[];
  smartPanel?: SmartPanel;
  relatedDocuments?: RelatedDocument[];
  memoryCardsUsed?: DocumentMemoryCard[];
  indexingVersion?: RagIndexingVersion | string | null;
  indexingQuality?: DocumentIndexQuality;
};

export type ExtractedPage = {
  pageNumber: number;
  text: string;
  ocrUsed?: boolean;
};

export type ExtractedImage = {
  pageNumber: number | null;
  path: string;
  mimeType: string;
  bbox?: [number, number, number, number] | null;
  width?: number | null;
  height?: number | null;
  sourceKind?: "embedded" | "table_crop" | "diagram_crop" | "page_region" | "fallback" | "cover_page";
  metadata?: Record<string, unknown>;
};

export type ExtractedDocument = {
  pages: ExtractedPage[];
  images: ExtractedImage[];
  warnings?: string[];
};

export type ChunkInput = {
  documentId: string;
  pageNumber: number | null;
  pageText: string;
  images?: Array<{
    id: string;
    caption: string;
    pageNumber: number | null;
    imageType?: ImageEvidenceCategory;
    sourceKind?: string | null;
    labels?: string[];
    tableLabel?: string | null;
    tableTitle?: string | null;
    tableRole?: string | null;
    tableTextSnippet?: string | null;
  }>;
  metadata?: Record<string, unknown>;
};

export type DocumentChunk = {
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  token_estimate: number;
  image_ids: string[];
  metadata: Record<string, unknown>;
};
