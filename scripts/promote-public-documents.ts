import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type PromoteArgs = {
  ownerId?: string;
  apply: boolean;
  limit?: number;
};

const PROMOTABLE_VALIDATION_STATUSES = ["locally_reviewed", "approved"] as const;

const RELATED_TABLES = [
  "document_labels",
  "document_summaries",
  "document_sections",
  "document_memory_cards",
  "document_table_facts",
  "document_embedding_fields",
  "document_index_quality",
  "document_index_units",
] as const;

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): PromoteArgs {
  const args: PromoteArgs = {
    ownerId: process.env.PUBLIC_WORKSPACE_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--owner-id") {
      args.ownerId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--limit") {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

type CandidateDocument = {
  id: string;
  title: string | null;
  file_name: string | null;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
};

async function fetchCandidates(
  supabase: Awaited<ReturnType<typeof loadAdminClient>>,
  ownerId?: string,
  limit?: number,
) {
  const candidates: CandidateDocument[] = [];
  const pageSize = 200;

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("documents")
      .select("id,title,file_name,owner_id,metadata")
      .eq("status", "indexed")
      .not("owner_id", "is", null)
      .in("metadata->>clinical_validation_status", [...PROMOTABLE_VALIDATION_STATUSES])
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (ownerId) query = query.eq("owner_id", ownerId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as CandidateDocument[];
    candidates.push(...rows);
    if (rows.length < pageSize) break;
    if (limit && candidates.length >= limit) break;
  }

  return limit ? candidates.slice(0, limit) : candidates;
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

async function clearOwnerOnRelatedRows(
  supabase: Awaited<ReturnType<typeof loadAdminClient>>,
  table: (typeof RELATED_TABLES)[number],
  documentIds: string[],
) {
  const { error } = await supabase.from(table).update({ owner_id: null }).in("document_id", documentIds);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function promoteBatch(
  supabase: Awaited<ReturnType<typeof loadAdminClient>>,
  batch: CandidateDocument[],
) {
  const now = new Date().toISOString();
  for (const document of batch) {
    const metadata = {
      ...(document.metadata ?? {}),
      public_corpus: true,
    };
    const { error } = await supabase
      .from("documents")
      .update({ owner_id: null, metadata, updated_at: now })
      .eq("id", document.id);
    if (error) throw new Error(`documents/${document.id}: ${error.message}`);
  }

  const documentIds = batch.map((document) => document.id);
  for (const table of RELATED_TABLES) {
    await clearOwnerOnRelatedRows(supabase, table, documentIds);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();

  const [candidates, publicBefore] = await Promise.all([
    fetchCandidates(supabase, args.ownerId, args.limit),
    countPublic(supabase),
  ]);

  console.log("[public-documents:promote] indexed public documents (before):", publicBefore);
  console.log(
    `[public-documents:promote] promotion candidates${args.ownerId ? ` for owner ${args.ownerId}` : ""}:`,
    candidates.length,
  );

  if (candidates.length > 0) {
    console.log("[public-documents:promote] sample candidates:");
    for (const document of candidates.slice(0, 8)) {
      console.log(
        `  - ${document.title ?? document.file_name ?? document.id} (${document.metadata?.clinical_validation_status ?? "unknown"})`,
      );
    }
    if (candidates.length > 8) console.log(`  ... and ${candidates.length - 8} more`);
  }

  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply to promote these documents to the public corpus.");
    return;
  }

  if (candidates.length === 0) {
    console.log("\nNothing to promote.");
    return;
  }

  const batchSize = 25;
  let promoted = 0;
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    await promoteBatch(supabase, batch);
    promoted += batch.length;
    console.log(`[public-documents:promote] promoted ${promoted}/${candidates.length}`);
  }

  const publicAfter = await countPublic(supabase);
  console.log("\n[public-documents:promote] indexed public documents (after):", publicAfter);
  console.log(`[public-documents:promote] promoted ${promoted} document(s) to owner_id IS NULL.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
