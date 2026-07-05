import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const BATCH_SIZE = 25;

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function countPublic(supabase: Awaited<ReturnType<typeof loadAdminClient>>) {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "indexed")
    .is("owner_id", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchBatchIds(supabase: Awaited<ReturnType<typeof loadAdminClient>>) {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "indexed")
    .not("owner_id", "is", null)
    .in("metadata->>clinical_validation_status", ["locally_reviewed", "approved"])
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function promoteBatch(supabase: Awaited<ReturnType<typeof loadAdminClient>>, ids: string[]) {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("documents")
    .update({
      owner_id: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

async function main() {
  const supabase = await loadAdminClient();
  let batches = 0;

  while (true) {
    const ids = await fetchBatchIds(supabase);
    if (ids.length === 0) break;
    await promoteBatch(supabase, ids);
    batches += 1;
    const publicCount = await countPublic(supabase);
    console.log(
      `[public-documents:promote] batch ${batches}: promoted ${ids.length}; public indexed total ${publicCount}`,
    );
  }

  console.log(`[public-documents:promote] complete. indexed public documents: ${await countPublic(supabase)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
