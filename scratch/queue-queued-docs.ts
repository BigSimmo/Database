import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { env } = await import("@/lib/env");
  const supabase = createAdminClient();

  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, metadata")
    .eq("status", "queued");

  if (error) {
    console.error("Error fetching queued documents:", error);
    return;
  }

  if (!docs || docs.length === 0) {
    console.log("No queued documents found to create jobs for.");
    return;
  }

  for (const doc of docs) {
    const metadata = doc.metadata as Record<string, any>;
    const batchId = metadata?.import_batch_id || null;

    console.log(`Creating ingestion job for document ${doc.id} (batch: ${batchId})`);

    const { data: existingJobs } = await supabase
      .from("ingestion_jobs")
      .select("id")
      .eq("document_id", doc.id);

    if (existingJobs && existingJobs.length > 0) {
      console.log(`Job already exists for document ${doc.id}, skipping.`);
      continue;
    }

    const { error: insertError } = await supabase.from("ingestion_jobs").insert({
      document_id: doc.id,
      batch_id: batchId,
      status: "pending",
      stage: "queued",
      progress: 0,
      max_attempts: env.WORKER_MAX_ATTEMPTS || 3,
    });

    if (insertError) {
      console.error(`Error inserting job for document ${doc.id}:`, insertError);
    } else {
      console.log(`Successfully created ingestion job for document ${doc.id}`);
    }
  }
}

main().catch(console.error);
