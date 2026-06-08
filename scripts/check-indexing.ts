import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type MetadataRow = {
  document_id: string;
  metadata?: unknown;
  source?: string | null;
  content_hash?: string | null;
  index_generation_id?: string | null;
  section_path?: string[] | null;
  anchor_id?: string | null;
  quality_score?: number | null;
  issues?: string[] | null;
};
type QueryResponse<T = unknown> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};
type QueryBuilder<T = unknown> = PromiseLike<QueryResponse<T>> & {
  eq(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  is(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: Record<string, unknown>): QueryBuilder<T>;
  range(from: number, to: number): PromiseLike<QueryResponse<T>>;
  limit(count: number): PromiseLike<QueryResponse<T>>;
};
type SupabaseLike = {
  from(table: string): {
    select<T = unknown>(columns: string, options?: Record<string, unknown>): QueryBuilder<T>;
  };
};

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function hasCurrentEnrichmentVersion(metadata: unknown, expectedVersion: string) {
  return metadataRecord(metadata).rag_enrichment_version === expectedVersion;
}

function hasCurrentMemoryVersion(metadata: unknown, expectedVersion: string) {
  const record = metadataRecord(metadata);
  return record.rag_memory_version === expectedVersion || record.rag_indexing_version === expectedVersion;
}

function strictEnrichmentVersionRequired() {
  return (
    process.argv.includes("--strict-enrichment-version") || process.env.RAG_REQUIRE_CURRENT_ENRICHMENT_VERSION === "1"
  );
}

async function loadEnrichmentRows(supabase: SupabaseLike, documentIds: string[]) {
  const summaries: MetadataRow[] = [];
  const labels: MetadataRow[] = [];

  for (let start = 0; start < documentIds.length; start += 100) {
    const ids = documentIds.slice(start, start + 100);
    const [summaryResult, labelResult] = await Promise.all([
      supabase.from("document_summaries").select("document_id,metadata").in("document_id", ids),
      supabase.from("document_labels").select("document_id,source,metadata").in("document_id", ids),
    ]);

    if (summaryResult.error) throw new Error(summaryResult.error.message);
    if (labelResult.error) throw new Error(labelResult.error.message);
    summaries.push(...((summaryResult.data ?? []) as MetadataRow[]));
    labels.push(...((labelResult.data ?? []) as MetadataRow[]));
  }

  return { summaries, labels };
}

async function loadRowsForDocuments(supabase: SupabaseLike, table: string, select: string, documentIds: string[]) {
  const rows: MetadataRow[] = [];
  for (let start = 0; start < documentIds.length; start += 100) {
    const ids = documentIds.slice(start, start + 100);
    for (let rangeStart = 0; ; rangeStart += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in("document_id", ids)
        .range(rangeStart, rangeStart + 999);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as MetadataRow[]));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

async function loadDeepMemoryRows(supabase: SupabaseLike, documentIds: string[]) {
  const [sections, memoryCards, chunks, tableFacts, embeddingFields, qualityRows] = await Promise.all([
    loadRowsForDocuments(supabase, "document_sections", "document_id,metadata", documentIds),
    loadRowsForDocuments(supabase, "document_memory_cards", "document_id,metadata", documentIds),
    loadRowsForDocuments(
      supabase,
      "document_chunks",
      "document_id,metadata,content_hash,index_generation_id,section_path,anchor_id",
      documentIds,
    ),
    loadRowsForDocuments(supabase, "document_table_facts", "document_id,metadata", documentIds),
    loadRowsForDocuments(
      supabase,
      "document_embedding_fields",
      "document_id,metadata",
      documentIds,
    ),
    loadRowsForDocuments(
      supabase,
      "document_index_quality",
      "document_id,quality_score,issues",
      documentIds,
    ),
  ]);
  return { sections, memoryCards, chunks, tableFacts, embeddingFields, qualityRows };
}

async function main() {
  const [
    { env, requireOpenAIEnv, requireServerEnv },
    { createAdminClient },
    { checkPythonPdfPrerequisites },
    { ragEnrichmentVersion },
    { ragDeepMemoryVersion },
  ] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
    import("../worker/prerequisites"),
    import("@/lib/document-enrichment"),
    import("@/lib/deep-memory"),
  ]);

  requireServerEnv();
  requireOpenAIEnv();

  const prereqs = await checkPythonPdfPrerequisites();
  if (!prereqs.ok) {
    throw new Error(`PDF/OCR prerequisite check failed: ${prereqs.detail}`);
  }

  const supabase = createAdminClient();
  const { error: batchError } = await supabase.from("import_batches").select("id").limit(1);
  if (batchError) throw new Error(batchError.message);
  const { error: jobError } = await supabase.from("ingestion_jobs").select("id,attempt_count,max_attempts").limit(1);
  if (jobError) throw new Error(jobError.message);
  const { error: cleanupTableError } = await supabase.from("storage_cleanup_jobs").select("id,status").limit(1);
  if (cleanupTableError) throw new Error(cleanupTableError.message);

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id,owner_id,title,content_hash,status,page_count,chunk_count,metadata");
  if (documentsError) throw new Error(documentsError.message);

  const supabaseForChecks = supabase as unknown as SupabaseLike;
  const indexedDocuments = (documents ?? []).filter((document) => document.status === "indexed");
  const enrichmentRows = await loadEnrichmentRows(
    supabaseForChecks,
    indexedDocuments.map((document) => document.id),
  );
  const deepMemoryRows = await loadDeepMemoryRows(
    supabaseForChecks,
    indexedDocuments.map((document) => document.id),
  );
  const summariesByDocument = new Map(enrichmentRows.summaries.map((row) => [row.document_id, row]));
  const labelRowsByDocument = new Map<string, MetadataRow[]>();
  const sectionRowsByDocument = new Map<string, MetadataRow[]>();
  const memoryRowsByDocument = new Map<string, MetadataRow[]>();
  const chunkRowsByDocument = new Map<string, MetadataRow[]>();
  for (const label of enrichmentRows.labels) {
    labelRowsByDocument.set(label.document_id, [...(labelRowsByDocument.get(label.document_id) ?? []), label]);
  }
  for (const section of deepMemoryRows.sections) {
    sectionRowsByDocument.set(section.document_id, [
      ...(sectionRowsByDocument.get(section.document_id) ?? []),
      section,
    ]);
  }
  for (const card of deepMemoryRows.memoryCards) {
    memoryRowsByDocument.set(card.document_id, [...(memoryRowsByDocument.get(card.document_id) ?? []), card]);
  }
  for (const chunk of deepMemoryRows.chunks) {
    chunkRowsByDocument.set(chunk.document_id, [...(chunkRowsByDocument.get(chunk.document_id) ?? []), chunk]);
  }

  const duplicateHashGroups = new Map<string, string[]>();
  for (const document of documents ?? []) {
    if (!document.owner_id || !document.content_hash) continue;
    const key = `${document.owner_id}:${document.content_hash}`;
    duplicateHashGroups.set(key, [...(duplicateHashGroups.get(key) ?? []), document.title ?? document.id]);
  }
  const duplicateGroups = Array.from(duplicateHashGroups.values()).filter((titles) => titles.length > 1);
  const emptyIndexedDocuments = (documents ?? []).filter(
    (document) =>
      document.status === "indexed" && ((document.page_count ?? 0) === 0 || (document.chunk_count ?? 0) === 0),
  );
  const documentsWithChunkCountMismatch = indexedDocuments.filter(
    (document) => (chunkRowsByDocument.get(document.id) ?? []).length !== (document.chunk_count ?? 0),
  );
  const documentsMissingSummaries = indexedDocuments.filter((document) => !summariesByDocument.has(document.id));
  const documentsMissingGeneratedLabels = indexedDocuments.filter((document) =>
    (labelRowsByDocument.get(document.id) ?? []).every((label) => label.source !== "generated"),
  );
  const documentsWithCurrentEnrichmentVersion = indexedDocuments.filter((document) => {
    const summary = summariesByDocument.get(document.id);
    const generatedLabels = (labelRowsByDocument.get(document.id) ?? []).filter(
      (label) => label.source === "generated",
    );
    return (
      hasCurrentEnrichmentVersion(document.metadata, ragEnrichmentVersion) &&
      hasCurrentEnrichmentVersion(summary?.metadata, ragEnrichmentVersion) &&
      generatedLabels.some((label) => hasCurrentEnrichmentVersion(label.metadata, ragEnrichmentVersion))
    );
  });
  const documentsMissingCurrentEnrichmentVersion =
    indexedDocuments.length - documentsWithCurrentEnrichmentVersion.length;
  const documentsMissingSections = indexedDocuments.filter(
    (document) => (sectionRowsByDocument.get(document.id) ?? []).length === 0,
  );
  const documentsMissingMemoryCards = indexedDocuments.filter(
    (document) => (memoryRowsByDocument.get(document.id) ?? []).length === 0,
  );
  const documentsWithCurrentDeepMemoryVersion = indexedDocuments.filter((document) => {
    const sections = sectionRowsByDocument.get(document.id) ?? [];
    const memoryCards = memoryRowsByDocument.get(document.id) ?? [];
    const chunks = chunkRowsByDocument.get(document.id) ?? [];
    return (
      hasCurrentMemoryVersion(document.metadata, ragDeepMemoryVersion) &&
      sections.some((section) => hasCurrentMemoryVersion(section.metadata, ragDeepMemoryVersion)) &&
      memoryCards.some((card) => hasCurrentMemoryVersion(card.metadata, ragDeepMemoryVersion)) &&
      chunks.length > 0 &&
      chunks.every((chunk) => hasCurrentMemoryVersion(chunk.metadata, ragDeepMemoryVersion))
    );
  });
  const documentsMissingCurrentDeepMemoryVersion =
    indexedDocuments.length - documentsWithCurrentDeepMemoryVersion.length;
  const chunksMissingContentHash = deepMemoryRows.chunks.filter((chunk) => !chunk.content_hash);
  const chunksMissingIndexGeneration = deepMemoryRows.chunks.filter((chunk) => !chunk.index_generation_id);
  const chunksMissingSectionPath = deepMemoryRows.chunks.filter((chunk) => !chunk.section_path?.length);
  const chunksMissingAnchors = deepMemoryRows.chunks.filter((chunk) => !chunk.anchor_id);
  const qualityByDocument = new Map(deepMemoryRows.qualityRows.map((row) => [row.document_id, row]));
  const documentsMissingQualityRows = indexedDocuments.filter((document) => !qualityByDocument.has(document.id));
  const documentsWithLowQualityScore = indexedDocuments.filter((document) => {
    const score = Number(qualityByDocument.get(document.id)?.quality_score ?? 1);
    return Number.isFinite(score) && score < 0.45;
  });
  const documentsMissingEmbeddingFields = indexedDocuments.filter(
    (document) => !deepMemoryRows.embeddingFields.some((row) => row.document_id === document.id),
  );
  const documentsWithStaleIndexGeneration = indexedDocuments.filter((document) => {
    const generation = metadataRecord(document.metadata).index_generation_id;
    const chunks = chunkRowsByDocument.get(document.id) ?? [];
    return Boolean(
      generation &&
      chunks.length > 0 &&
      chunks.some((chunk) => chunk.index_generation_id && chunk.index_generation_id !== generation),
    );
  });
  const requireCurrentEnrichmentVersion = strictEnrichmentVersionRequired();

  const [
    missingEmbeddingResult,
    failedJobsResult,
    activeJobsResult,
    imageCountResult,
    searchableImageResult,
    oversizedBatchesResult,
    cleanupIssuesResult,
  ] = await Promise.all([
    supabase.from("document_chunks").select("id", { count: "exact", head: true }).is("embedding", null),
    supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase
      .from("ingestion_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "processing"]),
    supabase.from("document_images").select("id", { count: "exact", head: true }),
    supabase.from("document_images").select("id", { count: "exact", head: true }).eq("searchable", true),
    supabase
      .from("import_batches")
      .select("id,name,total_files,status")
      .gt("total_files", 150)
      .in("status", ["queued", "processing"]),
    supabase
      .from("storage_cleanup_jobs")
      .select("id,status,last_error")
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(5),
  ]);

  for (const result of [
    missingEmbeddingResult,
    failedJobsResult,
    activeJobsResult,
    imageCountResult,
    searchableImageResult,
    oversizedBatchesResult,
    cleanupIssuesResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const issues: string[] = [];
  if (duplicateGroups.length > 0) issues.push(`duplicate content-hash groups: ${duplicateGroups.length}`);
  if ((missingEmbeddingResult.count ?? 0) > 0)
    issues.push(`chunks missing embeddings: ${missingEmbeddingResult.count}`);
  if (emptyIndexedDocuments.length > 0) issues.push(`empty indexed documents: ${emptyIndexedDocuments.length}`);
  if (documentsWithChunkCountMismatch.length > 0)
    issues.push(`indexed document chunk-count mismatches: ${documentsWithChunkCountMismatch.length}`);
  if (chunksMissingContentHash.length > 0)
    issues.push(`indexed chunks missing content hashes: ${chunksMissingContentHash.length}`);
  if (chunksMissingIndexGeneration.length > 0)
    issues.push(`indexed chunks missing index generation ids: ${chunksMissingIndexGeneration.length}`);
  if (chunksMissingSectionPath.length > 0)
    issues.push(`indexed chunks missing section paths: ${chunksMissingSectionPath.length}`);
  if (documentsMissingQualityRows.length > 0)
    issues.push(`indexed documents missing quality rows: ${documentsMissingQualityRows.length}`);
  if (documentsMissingEmbeddingFields.length > 0)
    issues.push(`indexed documents missing embedding fields: ${documentsMissingEmbeddingFields.length}`);
  if (documentsWithLowQualityScore.length > 0)
    issues.push(`indexed documents with low quality score: ${documentsWithLowQualityScore.length}`);
  if (documentsWithStaleIndexGeneration.length > 0)
    issues.push(`indexed documents with mixed generation chunks: ${documentsWithStaleIndexGeneration.length}`);
  if (documentsMissingSummaries.length > 0)
    issues.push(`indexed documents missing summaries: ${documentsMissingSummaries.length}`);
  if (documentsMissingGeneratedLabels.length > 0)
    issues.push(`indexed documents missing generated labels: ${documentsMissingGeneratedLabels.length}`);
  if (documentsMissingSections.length > 0)
    issues.push(`indexed documents missing sections: ${documentsMissingSections.length}`);
  if (documentsMissingMemoryCards.length > 0)
    issues.push(`indexed documents missing memory cards: ${documentsMissingMemoryCards.length}`);
  if (requireCurrentEnrichmentVersion && documentsMissingCurrentEnrichmentVersion > 0) {
    issues.push(`indexed documents missing current enrichment version: ${documentsMissingCurrentEnrichmentVersion}`);
  }
  if (requireCurrentEnrichmentVersion && documentsMissingCurrentDeepMemoryVersion > 0) {
    issues.push(`indexed documents missing current deep-memory version: ${documentsMissingCurrentDeepMemoryVersion}`);
  }
  if ((failedJobsResult.count ?? 0) > 0) issues.push(`failed ingestion jobs: ${failedJobsResult.count}`);
  if ((oversizedBatchesResult.data ?? []).length > 0) {
    issues.push(`active oversized import batches: ${(oversizedBatchesResult.data ?? []).length}`);
  }
  if ((cleanupIssuesResult.data ?? []).length > 0) {
    issues.push(`pending or failed storage cleanup jobs: ${(cleanupIssuesResult.data ?? []).length}`);
  }

  console.log("Indexing prerequisites ready.");
  console.log("Supabase bulk ingestion tables are reachable.");
  console.log(`Embedding model: ${env.OPENAI_EMBEDDING_MODEL}`);
  console.log(`Worker concurrency: ${env.WORKER_CONCURRENCY}`);
  console.log(`Documents: ${(documents ?? []).length}; empty indexed: ${emptyIndexedDocuments.length}`);
  console.log(`Chunk-count mismatches: ${documentsWithChunkCountMismatch.length}`);
  console.log(
    `Chunk fingerprint coverage: missing hashes=${chunksMissingContentHash.length}; missing generations=${chunksMissingIndexGeneration.length}; mixed-generation documents=${documentsWithStaleIndexGeneration.length}`,
  );
  console.log(
    `Section hierarchy coverage: chunks missing section paths=${chunksMissingSectionPath.length}; chunks missing anchors=${chunksMissingAnchors.length}`,
  );
  console.log(
    `Structured index coverage: table facts=${deepMemoryRows.tableFacts.length}; embedding fields=${deepMemoryRows.embeddingFields.length}; quality rows=${deepMemoryRows.qualityRows.length}/${indexedDocuments.length}; low-quality documents=${documentsWithLowQualityScore.length}`,
  );
  console.log(
    `Enrichment coverage: summaries missing=${documentsMissingSummaries.length}; generated labels missing=${documentsMissingGeneratedLabels.length}`,
  );
  console.log(
    `RAG enrichment version: ${documentsWithCurrentEnrichmentVersion.length}/${indexedDocuments.length} indexed current (${ragEnrichmentVersion}); strict=${requireCurrentEnrichmentVersion ? "yes" : "no"}`,
  );
  console.log(
    `Deep memory version: ${documentsWithCurrentDeepMemoryVersion.length}/${indexedDocuments.length} indexed current (${ragDeepMemoryVersion}); sections missing=${documentsMissingSections.length}; memory cards missing=${documentsMissingMemoryCards.length}`,
  );
  console.log(`Duplicate content-hash groups: ${duplicateGroups.length}`);
  console.log(`Chunks missing embeddings: ${missingEmbeddingResult.count ?? 0}`);
  console.log(`Failed jobs: ${failedJobsResult.count ?? 0}; pending/processing jobs: ${activeJobsResult.count ?? 0}`);
  console.log(`Images: ${imageCountResult.count ?? 0}; searchable: ${searchableImageResult.count ?? 0}`);
  console.log(`Active oversized batches: ${(oversizedBatchesResult.data ?? []).length}`);
  console.log(`Pending/failed storage cleanup jobs: ${(cleanupIssuesResult.data ?? []).length}`);

  if (issues.length > 0) {
    throw new Error(`Indexing readiness check failed: ${issues.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
