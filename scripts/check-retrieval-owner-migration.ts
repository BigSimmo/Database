import { createAdminClient } from "@/lib/supabase/admin";

const SENTINEL = "00000000-0000-0000-0000-000000000000";

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_schema_health");
  if (error) {
    console.error("[Retrieval Owner Migration] FAIL: search_schema_health unavailable:", error.message);
    process.exit(1);
  }

  const { data: sentinelCheck, error: sentinelError } = await supabase.rpc(
    "retrieval_owner_matches" as never,
    {
      owner_filter: SENTINEL,
      row_owner_id: null,
    } as never,
  );

  if (sentinelError) {
    console.error(
      "[Retrieval Owner Migration] FAIL: retrieval_owner_matches RPC missing or broken:",
      sentinelError.message,
    );
    process.exit(1);
  }

  if (sentinelCheck !== true) {
    console.error("[Retrieval Owner Migration] FAIL: sentinel did not match public owner_id IS NULL.");
    process.exit(1);
  }

  console.log("[Retrieval Owner Migration] PASS: retrieval_owner_matches sentinel is live.");
  console.log("[Retrieval Owner Migration] search_schema_health:", JSON.stringify(data));
}

main().catch((error) => {
  console.error("[Retrieval Owner Migration] FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
