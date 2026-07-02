import * as nextEnv from "@next/env";
import type { Json } from "@/lib/supabase/database.types";
import type { DocumentLabelType } from "@/lib/types";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
loadEnvConfig(process.cwd());

type Args = {
  allOwners: boolean;
  ownerId?: string;
  limit: number;
  write: boolean;
  confirm: boolean;
  help: boolean;
};

type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

type DocumentRow = {
  id: string;
  owner_id: string | null;
  title: string;
  file_name: string;
  metadata: Record<string, unknown> | null;
};

type LabelRow = {
  id: string;
  document_id: string;
  owner_id: string | null;
  label: string;
  label_type: DocumentLabelType;
  source: "generated" | "manual";
  confidence: number;
  metadata: Record<string, unknown> | null;
};

type SummaryRow = {
  document_id: string;
  summary: string | null;
};

type GoldLabelInsert = {
  document_id: string;
  owner_id: string | null;
  label: string;
  label_type: DocumentLabelType;
  source: "manual";
  confidence: number;
  metadata: Json;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    allOwners: false,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    limit: 5000,
    write: false,
    confirm: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--all-owners") {
      args.allOwners = true;
      continue;
    }
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirm = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;
    if (token === "--owner-id") args.ownerId = value;
    else if (token === "--limit") args.limit = Number(value);
    else throw new Error(`Unknown option: ${token}`);
  }

  if (!args.allOwners && !args.ownerId) throw new Error("Pass --owner-id or --all-owners.");
  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be positive.");
  if (args.write && !args.confirm) throw new Error("Writing requires --write --confirm after reviewing a dry-run.");
  return args;
}

function usage() {
  return [
    "Usage: npm run backfill:gold-labels -- [scope] [options]",
    "",
    "Backfills conservative high-value manual gold labels for indexed documents.",
    "",
    "Scopes:",
    "  --owner-id <uuid>       Backfill one owner.",
    "  --all-owners           Backfill across all owners.",
    "",
    "Options:",
    "  --limit <count>        Max indexed documents to scan. Default: 5000.",
    "  --write --confirm      Persist reviewed gold labels. Dry-run is the default.",
    "  --help                 Show this help.",
  ].join("\n");
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function loadDocuments(supabase: SupabaseAdmin, args: Args) {
  const rows: DocumentRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < args.limit; offset += pageSize) {
    let query = supabase
      .from("documents")
      .select("id,owner_id,title,file_name,metadata")
      .eq("status", "indexed")
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + pageSize - 1, args.limit - 1));
    if (!args.allOwners && args.ownerId) query = query.eq("owner_id", args.ownerId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as DocumentRow[]));
    if ((data ?? []).length < pageSize) break;
  }
  return rows;
}

async function loadLabels(supabase: SupabaseAdmin, documentIds: string[]) {
  const rows: LabelRow[] = [];
  for (const ids of chunkArray(documentIds, 25)) {
    const { data, error } = await supabase
      .from("document_labels")
      .select("id,document_id,owner_id,label,label_type,source,confidence,metadata")
      .in("document_id", ids);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as LabelRow[]));
  }
  return rows;
}

async function loadSummaries(supabase: SupabaseAdmin, documentIds: string[]) {
  const rows: SummaryRow[] = [];
  for (const ids of chunkArray(documentIds, 100)) {
    const { data, error } = await supabase.from("document_summaries").select("document_id,summary").in("document_id", ids);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as SummaryRow[]));
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const supabase = await loadAdminClient();
  const [{ missingGoldLabelsForDocument }, documents] = await Promise.all([
    import("@/lib/document-label-governance"),
    loadDocuments(supabase, args),
  ]);
  const documentIds = documents.map((document) => document.id);
  const [labels, summaries] = await Promise.all([loadLabels(supabase, documentIds), loadSummaries(supabase, documentIds)]);
  const labelsByDocument = new Map<string, LabelRow[]>();
  for (const label of labels) labelsByDocument.set(label.document_id, [...(labelsByDocument.get(label.document_id) ?? []), label]);
  const summariesByDocument = new Map(summaries.map((summary) => [summary.document_id, summary]));
  const stampedAt = new Date().toISOString();

  const inserts: GoldLabelInsert[] = [];
  for (const document of documents) {
    const missing = missingGoldLabelsForDocument({
      ...document,
      labels: labelsByDocument.get(document.id) ?? [],
      summary: summariesByDocument.get(document.id) ?? null,
    });
    for (const label of missing) {
      inserts.push({
        document_id: document.id,
        owner_id: document.owner_id,
        label: label.label,
        label_type: label.label_type,
        source: "manual",
        confidence: 1,
        metadata: {
          curated_at: stampedAt,
          curated_by: "gold-label-backfill",
          curation_reason: label.reason,
          review_status: "approved",
          gold_label: true,
        },
      });
    }
  }

  const affectedDocuments = new Set(inserts.map((insert) => insert.document_id));
  console.log(`${args.write ? "WRITE" : "DRY-RUN"} gold document label backfill`);
  console.log(`documents scanned: ${documents.length}`);
  console.log(`documents needing gold labels: ${affectedDocuments.size}`);
  console.log(`gold labels to upsert: ${inserts.length}`);
  for (const insert of inserts.slice(0, 25)) {
    const document = documents.find((row) => row.id === insert.document_id);
    console.log(`- ${document?.title ?? insert.document_id}: ${insert.label_type}:${insert.label}`);
  }
  if (!args.write) {
    console.log("\nNo writes performed. Re-run with --write --confirm after reviewing this output.");
    return;
  }

  let written = 0;
  for (const batch of chunkArray(inserts, 500)) {
    const { data, error } = await supabase
      .from("document_labels")
      .upsert(batch, { onConflict: "document_id,label_type,label,source" })
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== batch.length) {
      throw new Error(`gold label upsert expected ${batch.length} row(s), received ${(data ?? []).length}.`);
    }
    written += batch.length;
    console.log(`Upserted ${written}/${inserts.length} gold label(s).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
