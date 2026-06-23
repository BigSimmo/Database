import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type MetadataRow = {
  [key: string]: unknown;
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

type MetadataProjectionRow = {
  document_id?: unknown;
  source?: unknown;
  rag_memory_version?: unknown;
  rag_indexing_version?: unknown;
  rag_enrichment_version?: unknown;
  [key: string]: unknown;
};

function asMetadataProjection(row: unknown): MetadataProjectionRow {
  if (!row || typeof row !== "object" || Array.isArray(row)) return {};
  return row as MetadataProjectionRow;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function metadataRowFromProjection(row: MetadataProjectionRow): MetadataRow | null {
  if (typeof row.document_id !== "string" || row.document_id.length === 0) return null;

  const { rag_memory_version, rag_indexing_version, rag_enrichment_version, ...rest } = row;

  const nextMetadata: unknown =
    rag_memory_version !== undefined || rag_indexing_version !== undefined || rag_enrichment_version !== undefined
      ? {
          rag_memory_version: asNullableString(rag_memory_version),
          rag_indexing_version: asNullableString(rag_indexing_version),
          rag_enrichment_version: asNullableString(rag_enrichment_version),
        }
      : undefined;

  return {
    ...rest,
    document_id: row.document_id,
    ...(nextMetadata !== undefined ? { metadata: nextMetadata } : {}),
  } as MetadataRow;
}
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

type SchemaHealth = {
  ok?: boolean;
  missing?: unknown;
};

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

type DocumentHealthRow = {
  id: string;
  owner_id: string | null;
  title: string | null;
  content_hash: string | null;
  status: string | null;
  page_count: number | null;
  chunk_count: number | null;
  metadata: unknown;
};

async function loadAllDocuments(supabase: SupabaseLike, pageSize = 1000) {
  const documents: DocumentHealthRow[] = [];
  let cursor: string | null = null;

  for (;;) {
    const query = supabase
      .from("documents")
      .select<DocumentHealthRow>("id,owner_id,title,content_hash,status,page_count,chunk_count,metadata")
      .order("id", { ascending: true });
    const pagedQuery: QueryBuilder<DocumentHealthRow> = cursor ? query.gt("id", cursor) : query;

    const { data, error } = (await pagedQuery.limit(pageSize)) as QueryResponse<DocumentHealthRow>;
    if (error) throw new Error(error.message);

    documents.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    cursor = data.at(-1)?.id ?? null;
    if (!cursor) break;
  }

  return documents;
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

function maxPendingEnrichmentAllowed() {
  const raw = process.env.RAG_MAX_PENDING_ENRICHMENT ?? "0";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function missingSchemaMessage(error: { message: string } | Error | null | undefined) {
  const message = error instanceof Error ? error.message : error?.message;
  if (!message) return "";
  return /schema cache|relation .* does not exist|could not find the table|could not find the function|PGRST20\d/i.test(
    message,
  )
    ? message
    : "";
}

function readableReadinessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/<!doctype html|<html[\s>]/i.test(message)) {
    const title = message
      .match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    const code = message.match(/\b5\d\d\b/)?.[0];
    return `Supabase readiness query failed with an HTML gateway response${
      title ? ` (${title})` : code ? ` (${code})` : ""
    }. Retry once the Supabase project is responding normally.`;
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|Connection timed out|network/i.test(message)) {
    return `Supabase readiness query failed due to a network timeout: ${message.slice(0, 240)}`;
  }
  return message;
}

async function loadEnrichmentRows(supabase: SupabaseLike, documentIds: string[]) {
  const summaries: MetadataRow[] = [];
  const labels: MetadataRow[] = [];

  for (let start = 0; start < documentIds.length; start += 5) {
    const ids = documentIds.slice(start, start + 5);
    const [summaryResult, labelResult] = await Promise.all([
      supabase.from("document_summaries").select("document_id,metadata->rag_enrichment_version").in("document_id", ids),
      supabase
        .from("document_labels")
        .select("document_id,source,metadata->rag_enrichment_version")
        .in("document_id", ids),
    ]);

    if (summaryResult.error) throw new Error(summaryResult.error.message);
    if (labelResult.error) throw new Error(labelResult.error.message);

    const mappedSummaries: MetadataRow[] = [];
    for (const row of summaryResult.data ?? []) {
      const source = asMetadataProjection(row);
      const documentId = typeof source.document_id === "string" ? source.document_id : null;
      if (!documentId) continue;
      mappedSummaries.push({
        document_id: documentId,
        metadata: { rag_enrichment_version: asNullableString(source.rag_enrichment_version) },
      });
    }

    const mappedLabels: MetadataRow[] = [];
    for (const row of labelResult.data ?? []) {
      const source = asMetadataProjection(row);
      const documentId = typeof source.document_id === "string" ? source.document_id : null;
      if (!documentId) continue;
      mappedLabels.push({
        document_id: documentId,
        source: typeof source.source === "string" ? source.source : null,
        metadata: { rag_enrichment_version: asNullableString(source.rag_enrichment_version) },
      });
    }

    summaries.push(...mappedSummaries);
    labels.push(...mappedLabels);
  }

  return { summaries, labels };
}

async function loadRowsForDocuments(
  supabase: SupabaseLike,
  table: string,
  select: string,
  documentIds: string[],
  orderColumns = ["document_id", "id"],
) {
  const rows: MetadataRow[] = [];
  for (let start = 0; start < documentIds.length; start += 5) {
    const ids = documentIds.slice(start, start + 5);
    for (let rangeStart = 0; ; rangeStart += 1000) {
      let query = supabase.from(table).select(select).in("document_id", ids);
      for (const column of orderColumns) {
        query = query.order(column, { ascending: true });
      }
      const { data, error } = await query.range(rangeStart, rangeStart + 999);
      if (error) throw new Error(error.message);

      for (const row of data ?? []) {
        const metadataRow = metadataRowFromProjection(asMetadataProjection(row));
        if (metadataRow) rows.push(metadataRow);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

async function loadDeepMemoryRows(supabase: SupabaseLike, documentIds: string[]) {
  const sections = await loadRowsForDocuments(
    supabase,
    "document_sections",
    "document_id,metadata->rag_memory_version,metadata->rag_indexing_version",
    documentIds,
  );
  const memoryCards = await loadRowsForDocuments(
    supabase,
    "document_memory_cards",
    "document_id,metadata->rag_memory_version,metadata->rag_indexing_version",
    documentIds,
  );
  const chunks = await loadRowsForDocuments(
    supabase,
    "document_chunks",
    "document_id,metadata->rag_memory_version,metadata->rag_indexing_version,content_hash,index_generation_id,section_path,anchor_id",
    documentIds,
  );
  const tableFacts = await loadRowsForDocuments(
    supabase,
    "document_table_facts",
    "document_id,metadata->rag_memory_version,metadata->rag_indexing_version",
    documentIds,
  );
  const embeddingFields = await loadRowsForDocuments(
    supabase,
    "document_embedding_fields",
    "document_id,metadata->rag_memory_version,metadata->rag_indexing_version",
    documentIds,
  );
  const qualityRows = await loadRowsForDocuments(
    supabase,
    "document_index_quality",
    "document_id,quality_score,issues",
    documentIds,
    ["document_id"],
  );
  let indexUnits: MetadataRow[] = [];
  const missingSchema: string[] = [];
  try {
    indexUnits = await loadRowsForDocuments(
      supabase,
      "document_index_units",
      "document_id,metadata->rag_memory_version,metadata->rag_indexing_version",
      documentIds,
    );
  } catch (error) {
    const message = missingSchemaMessage(error instanceof Error ? error : null);
    if (!message) throw error;
    missingSchema.push(`document_index_units table is missing or not exposed to the Data API: ${message}`);
  }
  return { sections, memoryCards, chunks, tableFacts, embeddingFields, indexUnits, qualityRows, missingSchema };
}

async function main() {
  const [
    { env, requireOpenAIEnv, requireServerEnv },
    { createAdminClient },
    { assertSupabaseHealthy, probeSupabaseHealth },
    { checkPythonPdfPrerequisites },
    { ragEnrichmentVersion },
    { ragDeepMemoryVersion },
  ] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/health"),
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
  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Indexing check");
  const { error: batchError } = await supabase.from("import_batches").select("id").limit(1);
  if (batchError) throw new Error(batchError.message);
  const { error: jobError } = await supabase.from("ingestion_jobs").select("id,attempt_count,max_attempts").limit(1);
  if (jobError) throw new Error(jobError.message);
  const { error: cleanupTableError } = await supabase.from("storage_cleanup_jobs").select("id,status").limit(1);
  if (cleanupTableError) throw new Error(cleanupTableError.message);
  const { data: schemaHealth, error: schemaHealthError } = await supabase.rpc("search_schema_health");
  const schemaHealthMissing =
    schemaHealth && typeof schemaHealth === "object" && !Array.isArray(schemaHealth)
      ? ((schemaHealth as SchemaHealth).missing as unknown[] | undefined)
      : undefined;

  const supabaseForChecks = supabase as unknown as SupabaseLike;
  const documents = await loadAllDocuments(supabaseForChecks);
  const indexedDocuments = documents.filter(
    (document) => document.status === "indexed" && metadataRecord(document.metadata).enrichment_status !== "pending",
  );
  const pendingIndexedDocuments = documents.filter(
    (document) => document.status === "indexed" && metadataRecord(document.metadata).enrichment_status === "pending",
  );
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
  const emptyIndexedDocuments = indexedDocuments.filter(
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
  const documentsMissingIndexUnits = indexedDocuments.filter(
    (document) => !deepMemoryRows.indexUnits.some((row) => row.document_id === document.id),
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
  const pendingEnrichmentLimit = maxPendingEnrichmentAllowed();

  const missingEmbeddingResult = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);
  const failedJobsResult = await supabase
    .from("ingestion_jobs")
    .select("id,documents!inner(status,chunk_count)")
    .eq("status", "failed");
  const activeJobsResult = await supabase
    .from("ingestion_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "processing"]);
  const imageCountResult = await supabase.from("document_images").select("id", { count: "exact", head: true });
  const searchableImageResult = await supabase
    .from("document_images")
    .select("id", { count: "exact", head: true })
    .eq("searchable", true);
  const oversizedBatchesResult = await supabase
    .from("import_batches")
    .select("id,name,total_files,status")
    .gt("total_files", 150)
    .in("status", ["queued", "processing"]);
  const cleanupIssuesResult = await supabase
    .from("storage_cleanup_jobs")
    .select("id,status,last_error")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(5);

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
  const actionableFailedJobs = (failedJobsResult.data ?? []).filter((job) => {
    const document = Array.isArray(job.documents) ? job.documents[0] : job.documents;
    return document?.status !== "indexed" || Number(document?.chunk_count ?? 0) === 0;
  });

  const issues: string[] = [];
  if (schemaHealthError) {
    issues.push(`schema health RPC failed: ${schemaHealthError.message}`);
  }
  for (const missing of schemaHealthMissing ?? []) {
    issues.push(`missing schema object: ${String(missing)}`);
  }
  for (const missing of deepMemoryRows.missingSchema) {
    issues.push(`missing schema object: ${missing}`);
  }
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
  if (documentsMissingIndexUnits.length > 0)
    issues.push(`indexed documents missing index units: ${documentsMissingIndexUnits.length}`);
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
  if (pendingIndexedDocuments.length > pendingEnrichmentLimit) {
    issues.push(`pending enrichment queue exceeds limit: ${pendingIndexedDocuments.length}/${pendingEnrichmentLimit}`);
  }
  if (actionableFailedJobs.length > 0) issues.push(`actionable failed ingestion jobs: ${actionableFailedJobs.length}`);
  if ((cleanupIssuesResult.data ?? []).length > 0) {
    issues.push(`pending or failed storage cleanup jobs: ${(cleanupIssuesResult.data ?? []).length}`);
  }

  console.log("Indexing prerequisite base tables are reachable.");
  console.log("Supabase bulk ingestion tables are reachable.");
  console.log(
    `Search schema health: ${
      schemaHealthError
        ? `failed (${schemaHealthError.message})`
        : schemaHealthMissing?.length
          ? `missing ${schemaHealthMissing.map(String).join(", ")}`
          : "ready"
    }`,
  );
  console.log(`Embedding model: ${env.OPENAI_EMBEDDING_MODEL}`);
  console.log(`Worker concurrency: ${env.WORKER_CONCURRENCY}`);
  console.log(
    `Documents: ${documents.length}; completed indexed: ${indexedDocuments.length}; pending indexed: ${pendingIndexedDocuments.length}`,
  );
  console.log(
    `Indexed documents: completed=${indexedDocuments.length}; pending=${pendingIndexedDocuments.length}; empty=${emptyIndexedDocuments.length}`,
  );
  if (pendingIndexedDocuments.length > 0) {
    console.log(`Pending enrichment queue: ${pendingIndexedDocuments.length}; limit=${pendingEnrichmentLimit}`);
  }
  console.log(`Chunk-count mismatches: ${documentsWithChunkCountMismatch.length}`);
  console.log(
    `Chunk fingerprint coverage: missing hashes=${chunksMissingContentHash.length}; missing generations=${chunksMissingIndexGeneration.length}; mixed-generation documents=${documentsWithStaleIndexGeneration.length}`,
  );
  console.log(
    `Section hierarchy coverage: chunks missing section paths=${chunksMissingSectionPath.length}; chunks missing anchors=${chunksMissingAnchors.length}`,
  );
  console.log(
    `Structured index coverage: table facts=${deepMemoryRows.tableFacts.length}; embedding fields=${deepMemoryRows.embeddingFields.length}; index units=${deepMemoryRows.indexUnits.length}; quality rows=${deepMemoryRows.qualityRows.length}/${indexedDocuments.length}; low-quality documents=${documentsWithLowQualityScore.length}`,
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
  console.log(
    `Failed jobs: ${(failedJobsResult.data ?? []).length}; actionable failed: ${actionableFailedJobs.length}; pending/processing jobs: ${activeJobsResult.count ?? 0}`,
  );
  console.log(`Images: ${imageCountResult.count ?? 0}; searchable: ${searchableImageResult.count ?? 0}`);
  console.log(`Active oversized batches: ${(oversizedBatchesResult.data ?? []).length} (ignored for readiness)`);
  console.log(`Pending/failed storage cleanup jobs: ${(cleanupIssuesResult.data ?? []).length}`);

  if (issues.length > 0) {
    const completionSplit = `indexed completion split: completed=${indexedDocuments.length}; pending=${pendingIndexedDocuments.length}`;
    issues.push(completionSplit);
    throw new Error(`Indexing readiness check failed: ${issues.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(readableReadinessError(error));
  process.exitCode = 1;
});
