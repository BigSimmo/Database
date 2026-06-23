import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();
  
  const { data: jobs, error } = await supabase
    .from("ingestion_jobs")
    .select("id, status, error_message, attempt_count, locked_at, document_id, documents(title)")
    .in("status", ["pending", "processing"]);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("=== Active Ingestion Jobs ===");
  console.log(JSON.stringify(jobs, null, 2));
}

main().catch(console.error);
