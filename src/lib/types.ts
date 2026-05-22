export type DocumentStatus = "queued" | "processing" | "indexed" | "failed";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

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
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  page_count: number;
  chunk_count: number;
  image_count: number;
  error_message: string | null;
  metadata?: Record<string, unknown> | ClinicalSourceMetadata | null;
  created_at: string;
  updated_at: string;
};

export type IngestionJob = {
  id: string;
  document_id: string;
  status: JobStatus;
  stage: string;
  progress: number;
  error_message: string | null;
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
};

export type RagAnswer = {
  answer: string;
  grounded: boolean;
  confidence: "high" | "medium" | "low" | "unsupported";
  citations: Citation[];
  sources: SearchResult[];
  answerSections?: AnswerSection[];
  evidenceSummary?: EvidenceSummary;
  conflictsOrGaps?: ConflictOrGap[];
  sourceCoverage?: SourceCoverage;
  quoteCards?: QuoteCard[];
  visualEvidence?: VisualEvidenceCard[];
  bestSource?: BestSourceRecommendation | null;
  documentBreakdown?: DocumentBreakdown[];
  smartPanel?: SmartPanel;
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
};

export type ExtractedDocument = {
  pages: ExtractedPage[];
  images: ExtractedImage[];
};

export type ChunkInput = {
  documentId: string;
  pageNumber: number | null;
  pageText: string;
  images?: Array<{ id: string; caption: string; pageNumber: number | null }>;
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
