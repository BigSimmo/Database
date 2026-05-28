import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ env, requireOpenAIEnv, requireServerEnv }, { createAdminClient }, { checkPythonPdfPrerequisites }] =
    await Promise.all([
      import("@/lib/env"),
      import("@/lib/supabase/admin"),
      import("../worker/prerequisites"),
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
    .select("id,owner_id,title,content_hash,status,page_count,chunk_count");
  if (documentsError) throw new Error(documentsError.message);

  const duplicateHashGroups = new Map<string, string[]>();
  for (const document of documents ?? []) {
    if (!document.owner_id || !document.content_hash) continue;
    const key = `${document.owner_id}:${document.content_hash}`;
    duplicateHashGroups.set(key, [...(duplicateHashGroups.get(key) ?? []), document.title ?? document.id]);
  }
  const duplicateGroups = Array.from(duplicateHashGroups.values()).filter((titles) => titles.length > 1);
  const emptyIndexedDocuments = (documents ?? []).filter(
    (document) => document.status === "indexed" && ((document.page_count ?? 0) === 0 || (document.chunk_count ?? 0) === 0),
  );

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
    supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
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
  if ((missingEmbeddingResult.count ?? 0) > 0) issues.push(`chunks missing embeddings: ${missingEmbeddingResult.count}`);
  if (emptyIndexedDocuments.length > 0) issues.push(`empty indexed documents: ${emptyIndexedDocuments.length}`);
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
