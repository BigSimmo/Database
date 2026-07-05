import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const BATCH_SIZE = 25;

function withPublicCorpusMetadata(metadata: unknown): Record<string, unknown> {
  const base =
    typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...base, public_corpus: true };
}

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
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function promoteBatch(supabase: Awaited<ReturnType<typeof loadAdminClient>>, ids: string[]) {
  if (ids.length === 0) return;

  const updatedAt = new Date().toISOString();
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, metadata")
    .in("id", ids);
  if (fetchError) throw new Error(fetchError.message);

  await Promise.all(
    (documents ?? []).map(async (document) => {
      const { error } = await supabase
        .from("documents")
        .update({
          owner_id: null,
          metadata: withPublicCorpusMetadata(document.metadata),
          updated_at: updatedAt,
        })
        .eq("id", document.id);
      if (error) throw new Error(error.message);
    }),
  );

  const artifactUpdates = await Promise.all([
    supabase.from("document_labels").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
    supabase.from("document_summaries").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
    supabase.from("document_sections").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
    supabase.from("document_memory_cards").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
    supabase.from("document_table_facts").update({ owner_id: null }).in("document_id", ids),
    supabase.from("document_embedding_fields").update({ owner_id: null }).in("document_id", ids),
    supabase.from("document_index_quality").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
    supabase.from("document_index_units").update({ owner_id: null, updated_at: updatedAt }).in("document_id", ids),
  ]);
  for (const { error } of artifactUpdates) {
    if (error) throw new Error(error.message);
  }
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
