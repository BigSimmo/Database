import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();
  
  // Total in documents table
  const { data: docCounts, error: docError } = await supabase
    .from("documents")
    .select("status, metadata");
  
  if (docError) {
    console.error("Error fetching documents:", docError);
    return;
  }
  
  const statusCounts: Record<string, number> = {};
  let enrichmentPending = 0;
  
  for (const doc of docCounts || []) {
    statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
    const meta = doc.metadata && typeof doc.metadata === "object" ? (doc.metadata as any) : {};
    if (meta.enrichment_status === "pending") {
      enrichmentPending++;
    }
  }
  
  console.log("=== Document Table Status ===");
  console.log("Total rows in documents table:", docCounts?.length);
  console.log("Breakdown by status:", statusCounts);
  console.log("Documents with metadata.enrichment_status === 'pending':", enrichmentPending);
  
  // Total in ingestion_jobs
  const { data: jobCounts, error: jobError } = await supabase
    .from("ingestion_jobs")
    .select("status");
    
  if (jobError) {
    console.error("Error fetching jobs:", jobError);
    return;
  }
  
  const jobStatusCounts: Record<string, number> = {};
  for (const job of jobCounts || []) {
    jobStatusCounts[job.status] = (jobStatusCounts[job.status] || 0) + 1;
  }
  
  console.log("=== Ingestion Jobs Status ===");
  console.log("Total jobs:", jobCounts?.length);
  console.log("Breakdown by status:", jobStatusCounts);
}

main().catch(console.error);
