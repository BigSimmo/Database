import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();
  
  const { data: sampleDocs, error } = await supabase
    .from("documents")
    .select("id, title, status, metadata")
    .limit(10);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("=== Sample Documents ===");
  console.log(JSON.stringify(sampleDocs, null, 2));
}

main().catch(console.error);
