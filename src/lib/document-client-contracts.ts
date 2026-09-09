import { z } from "zod";
import type { DocumentDetailPayload } from "@/lib/document-detail-contract";

const metadataSchema = z.record(z.string(), z.unknown());
const nullableFiniteNumber = z.number().finite().nullable();

const documentLabelSchema = z
  .object({
    id: z.string(),
    document_id: z.string(),
    owner_id: z.string().nullable().optional(),
    label: z.string(),
    label_type: z.enum([
      "site",
      "topic",
      "document_type",
      "medication",
      "risk",
      "setting",
      "workflow",
      "population",
      "service",
      "clinical_action",
      "care_phase",
      "document_intent",
      "content_feature",
      "custom",
    ]),
    source: z.enum(["generated", "manual"]),
    confidence: z.number().finite(),
    metadata: metadataSchema.nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

const documentSummarySchema = z
  .object({
    id: z.string(),
    document_id: z.string(),
    owner_id: z.string().nullable().optional(),
    summary: z.string(),
    clinical_specifics: z.object({}).passthrough(),
    source_chunk_ids: z.array(z.string()).optional(),
    source_image_ids: z.array(z.string()).optional(),
    model: z.string().nullable().optional(),
    metadata: metadataSchema.optional(),
    generated_at: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

const clinicalDocumentSchema = z
  .object({
    id: z.string(),
    owner_id: z.string().nullable().optional(),
    title: z.string(),
    description: z.string().nullable(),
    file_name: z.string(),
    file_type: z.string(),
    file_size: z.number().finite().nonnegative(),
    storage_path: z.string().optional(),
    content_hash: z.string().nullable().optional(),
    source_path: z.string().nullable().optional(),
    import_batch_id: z.string().nullable().optional(),
    status: z.enum(["queued", "processing", "indexed", "failed"]),
    page_count: z.number().int().nonnegative(),
    chunk_count: z.number().int().nonnegative(),
    image_count: z.number().int().nonnegative(),
    error_message: z.string().nullable().optional(),
    metadata: metadataSchema.nullable().optional(),
    labels: z.array(documentLabelSchema).optional(),
    summary: documentSummarySchema.nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

const detailPageSchema = z
  .object({
    id: z.string(),
    page_number: z.number().int().positive(),
    text: z.string(),
    ocr_used: z.boolean(),
    metadata: metadataSchema.nullable().optional(),
  })
  .strict();

const detailImageSchema = z
  .object({
    id: z.string(),
    page_number: z.number().int().positive().nullable(),
    caption: z.string(),
    image_type: z.string().nullable().optional(),
    searchable: z.boolean().nullable().optional(),
    clinical_relevance_score: nullableFiniteNumber.optional(),
    labels: z.array(z.string()).nullable().optional(),
    source_kind: z.string().nullable().optional(),
    tableLabel: z.string().nullable().optional(),
    tableTitle: z.string().nullable().optional(),
    tableRole: z.string().nullable().optional(),
    tableTextSnippet: z.string().nullable().optional(),
    clinicalUseClass: z.string().nullable().optional(),
    clinicalUseReason: z.string().nullable().optional(),
    accessibleTableMarkdown: z.string().nullable().optional(),
    tableRows: z.array(z.array(z.string())).nullable().optional(),
    tableColumns: z.array(z.string()).nullable().optional(),
    rowCount: nullableFiniteNumber.optional(),
    rowsTruncated: z.boolean().nullable().optional(),
    columnCount: nullableFiniteNumber.optional(),
    width: nullableFiniteNumber.optional(),
    height: nullableFiniteNumber.optional(),
    cropCompleteness: nullableFiniteNumber.optional(),
    imageQualityScore: nullableFiniteNumber.optional(),
    ocrTextDensity: nullableFiniteNumber.optional(),
    structuredExtractionConfidence: nullableFiniteNumber.optional(),
    retainedForDocumentView: z.boolean().nullable().optional(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  })
  .strict();

const detailTableFactSchema = z
  .object({
    id: z.string(),
    document_id: z.string(),
    source_image_id: z.string().nullable(),
    page_number: z.number().int().positive().nullable(),
    table_title: z.string().nullable(),
    row_label: z.string().nullable(),
    clinical_parameter: z.string().nullable(),
    threshold_value: z.string().nullable(),
    action: z.string().nullable(),
    metadata: metadataSchema.nullable().optional(),
  })
  .strict();

const detailChunkSchema = z
  .object({
    id: z.string(),
    page_number: z.number().int().positive().nullable(),
    chunk_index: z.number().int().nonnegative(),
    section_heading: z.string().nullable(),
    content: z.string(),
    image_ids: z.array(z.string()),
    metadata: metadataSchema.nullable().optional(),
  })
  .strict();

const pageWindowSchema = z
  .object({
    from: z.number().int().positive(),
    to: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative().nullable(),
    hasBefore: z.boolean(),
    hasAfter: z.boolean(),
  })
  .strict();
const chunkWindowSchema = z
  .object({
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative().nullable(),
    hasBefore: z.boolean(),
    hasAfter: z.boolean(),
    selectedChunkId: z.string().nullable(),
  })
  .strict();

export const documentDetailResponseSchema = z
  .object({
    document: clinicalDocumentSchema,
    pages: z.array(detailPageSchema),
    images: z.array(detailImageSchema),
    tableFacts: z.array(detailTableFactSchema),
    chunks: z.array(detailChunkSchema),
    indexHealth: z
      .object({
        extractionQuality: z.string().nullable().optional(),
        indexedAt: z.string().nullable().optional(),
        indexVersion: z.string().nullable().optional(),
        warnings: z.unknown().optional(),
      })
      .strict()
      .optional(),
    demoMode: z.boolean(),
    assetScope: z.enum(["document", "window"]),
    window: z
      .object({
        requestedPage: z.number().int().positive(),
        effectivePage: z.number().int().positive(),
        selectedChunkId: z.string().nullable(),
        pages: pageWindowSchema,
        chunks: chunkWindowSchema,
      })
      .strict(),
    pageWindow: pageWindowSchema,
    chunkWindow: chunkWindowSchema,
  })
  .strict();

/**
 * Keeps the server and browser on the same exact document-detail wire contract.
 * Parsing at the producer boundary prevents a private or fixture-only field
 * from turning into a generic client-side "invalid response" failure.
 */
export function parseDocumentDetailPayload(input: unknown): DocumentDetailPayload {
  return documentDetailResponseSchema.parse(input) as DocumentDetailPayload;
}

const documentSearchResultSchema = z
  .object({
    id: z.string(),
    page_number: z.number().int().positive().nullable(),
    chunk_index: z.number().int().nonnegative(),
    section_heading: z.string().nullable(),
    snippet: z.string(),
    matched_terms: z.array(z.string()),
    image_ids: z.array(z.string()),
    text_rank: nullableFiniteNumber.optional(),
    trigram_score: nullableFiniteNumber.optional(),
    score: z.number().finite(),
  })
  .strict();

export const documentSearchResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(documentSearchResultSchema),
    pageHits: z.array(z.number().int().positive()),
    hitCount: z.number().int().nonnegative(),
    demoMode: z.boolean().optional(),
    strategy: z.enum(["document_not_indexed", "full_text_trigram_rpc", "portable_ilike_fallback"]).optional(),
  })
  .strict();
