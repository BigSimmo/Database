import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function tryRpc(
  supabase: Awaited<ReturnType<typeof import("../src/lib/supabase/admin").createAdminClient>>,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc(name as never, args as never);
  return {
    data,
    error: error?.message ?? null,
    code: (error as { code?: string } | null)?.code ?? null,
  };
}

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  console.log("Checking live Supabase: Clinical KB Database (sjrfecxgysukkwxsowpy)\n");

  const health = await tryRpc(supabase, "search_schema_health", {});
  console.log("search_schema_health:", JSON.stringify(health, null, 2));

  const helper = await tryRpc(supabase, "retrieval_owner_matches", {
    owner_filter: "00000000-0000-0000-0000-000000000000",
    row_owner_id: null,
  });
  console.log("\nretrieval_owner_matches (sentinel + null owner):", JSON.stringify(helper, null, 2));

  const { count: publicDocs, error: publicErr } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .is("owner_id", null)
    .eq("status", "indexed");
  console.log("\nindexed public documents:", JSON.stringify({ count: publicDocs, error: publicErr?.message ?? null }));

  const sentinelSearch = await tryRpc(supabase, "match_document_chunks_text", {
    query_text: "monitoring",
    match_count: 5,
    document_filters: null,
    owner_filter: "00000000-0000-0000-0000-000000000000",
  });
  console.log(
    "\nmatch_document_chunks_text (public sentinel):",
    JSON.stringify(
      {
        resultCount: Array.isArray(sentinelSearch.data) ? sentinelSearch.data.length : null,
        error: sentinelSearch.error,
        code: sentinelSearch.code,
      },
      null,
      2,
    ),
  );

  console.log("\n=== VERDICT ===");
  if (helper.code === "PGRST202" || helper.error?.includes("Could not find the function")) {
    console.log("NOT APPLIED — retrieval_owner_matches is missing on live Supabase.");
    process.exit(1);
  }
  if (helper.data === true && Array.isArray(sentinelSearch.data)) {
    console.log("APPLIED — helper exists and hybrid RPC accepts the public sentinel.");
    process.exit(0);
  }
  console.log("UNCLEAR — review the output above.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
