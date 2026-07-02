import * as nextEnv from "@next/env";
import type { DocumentLabelType } from "@/lib/types";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
loadEnvConfig(process.cwd());

type Args = {
  json: boolean;
  help: boolean;
  sampleSize: number;
  limit: number;
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

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false, help: false, sampleSize: 100, limit: 5000 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;
    if (token === "--sample-size") args.sampleSize = Number(value);
    else if (token === "--limit") args.limit = Number(value);
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!Number.isInteger(args.sampleSize) || args.sampleSize <= 0) throw new Error("--sample-size must be positive.");
  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be positive.");
  return args;
}

function usage() {
  return [
    "Usage: npm run check:document-label-governance -- [options]",
    "",
    "Runs deterministic document-label analytics, QA sampling, gold-label coverage, and label relevance checks.",
    "",
    "Options:",
    "  --json                 Print machine-readable JSON.",
    "  --sample-size <count>  QA sample size. Default: 100.",
    "  --limit <count>        Max indexed documents to audit. Default: 5000.",
    "  --help                 Show this help.",
  ].join("\n");
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function loadDocuments(supabase: SupabaseAdmin, limit: number) {
  const rows: DocumentRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,metadata")
      .eq("status", "indexed")
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + pageSize - 1, limit - 1));
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
    const { data, error } = await supabase
      .from("document_summaries")
      .select("document_id,summary")
      .in("document_id", ids);
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
  const [{ buildDocumentLabelGovernanceReport }, documents] = await Promise.all([
    import("@/lib/document-label-governance"),
    loadDocuments(supabase, args.limit),
  ]);
  const documentIds = documents.map((document) => document.id);
  const [labels, summaries] = await Promise.all([
    loadLabels(supabase, documentIds),
    loadSummaries(supabase, documentIds),
  ]);
  const labelsByDocument = new Map<string, LabelRow[]>();
  for (const label of labels)
    labelsByDocument.set(label.document_id, [...(labelsByDocument.get(label.document_id) ?? []), label]);
  const summariesByDocument = new Map(summaries.map((summary) => [summary.document_id, summary]));

  const report = buildDocumentLabelGovernanceReport(
    documents.map((document) => ({
      ...document,
      labels: labelsByDocument.get(document.id) ?? [],
      summary: summariesByDocument.get(document.id) ?? null,
    })),
    args.sampleSize,
  );

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("[Document Label Governance]");
    console.log(`Documents: ${report.analytics.documents}`);
    console.log(`Labels: ${report.analytics.labelRows}`);
    console.log(`Manual/generated: ${report.analytics.manual}/${report.analytics.generated}`);
    console.log(`Hidden/approved: ${report.analytics.hidden}/${report.analytics.approved}`);
    console.log(`Low confidence generated labels: ${report.analytics.lowConfidence}`);
    console.log(`Quality warnings: ${report.analytics.qualityIssues.length}`);
    console.log(`Blocking quality issues: ${report.analytics.blockingQualityIssues.length}`);
    console.log(`Missing gold-label rows: ${report.analytics.missingGoldLabels.length}`);
    console.log(
      `Relevance checks: ${report.relevanceChecks.filter((check) => check.passed).length}/${report.relevanceChecks.length} passed`,
    );
    console.log(report.passed ? "PASS: label governance checks passed." : "FAIL: label governance checks need review.");
  }

  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
