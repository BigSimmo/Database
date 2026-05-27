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

  console.log("Indexing prerequisites ready.");
  console.log("Supabase bulk ingestion tables are reachable.");
  console.log(`Embedding model: ${env.OPENAI_EMBEDDING_MODEL}`);
  console.log(`Worker concurrency: ${env.WORKER_CONCURRENCY}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
