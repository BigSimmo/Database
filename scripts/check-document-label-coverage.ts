import * as nextEnv from "@next/env";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
loadEnvConfig(process.cwd());

type CoverageArgs = {
  json: boolean;
  help: boolean;
};

type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

type DocumentRow = {
  id: string;
};

type LabelRow = {
  document_id: string;
  label_type: string;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): CoverageArgs {
  const args: CoverageArgs = { json: false, help: false };

  for (const token of argv) {
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  return args;
}

function usage() {
  return [
    "Usage: npm run check:document-label-coverage -- [options]",
    "",
    "Checks every indexed document has generated site and document_type labels.",
    "",
    "Options:",
    "  --json    Print machine-readable JSON.",
    "  --help    Show this help.",
  ].join("\n");
}

async function fetchAll<T>(
  supabase: SupabaseAdmin,
  table: "documents" | "document_labels",
  select: string,
  filter: (query: QueryBuilder<T>) => QueryBuilder<T>,
) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const baseQuery = supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1) as unknown as QueryBuilder<T>;
    const query = filter(baseQuery);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

function countByLabelType(labels: LabelRow[]) {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label.label_type, (counts.get(label.label_type) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const supabase = await loadAdminClient();
  const documents = await fetchAll<DocumentRow>(supabase, "documents", "id", (query) => query.eq("status", "indexed"));
  const labels = await fetchAll<LabelRow>(supabase, "document_labels", "document_id,label_type", (query) =>
    query.eq("source", "generated"),
  );

  const documentIds = new Set(documents.map((document) => document.id));
  const generatedDocumentIds = new Set(labels.map((label) => label.document_id));
  const siteDocumentIds = new Set(
    labels.filter((label) => label.label_type === "site").map((label) => label.document_id),
  );
  const documentTypeDocumentIds = new Set(
    labels.filter((label) => label.label_type === "document_type").map((label) => label.document_id),
  );

  const missingGenerated = [...documentIds].filter((id) => !generatedDocumentIds.has(id));
  const missingSite = [...documentIds].filter((id) => !siteDocumentIds.has(id));
  const missingDocumentType = [...documentIds].filter((id) => !documentTypeDocumentIds.has(id));
  const passed = missingGenerated.length === 0 && missingSite.length === 0 && missingDocumentType.length === 0;

  const report = {
    indexed_documents: documents.length,
    generated_label_rows: labels.length,
    generated_documents: generatedDocumentIds.size,
    indexed_without_generated: missingGenerated.length,
    indexed_without_site: missingSite.length,
    indexed_without_document_type: missingDocumentType.length,
    labels_by_type: countByLabelType(labels),
    sample_missing_generated: missingGenerated.slice(0, 10),
    sample_missing_site: missingSite.slice(0, 10),
    sample_missing_document_type: missingDocumentType.slice(0, 10),
    passed,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("[Document Label Coverage]");
    console.log(`Indexed documents: ${report.indexed_documents}`);
    console.log(`Generated label rows: ${report.generated_label_rows}`);
    console.log(`Documents with generated labels: ${report.generated_documents}`);
    console.log(`Indexed without generated labels: ${report.indexed_without_generated}`);
    console.log(`Indexed without site label: ${report.indexed_without_site}`);
    console.log(`Indexed without document_type label: ${report.indexed_without_document_type}`);
    console.log(
      `Labels by type: ${Object.entries(report.labels_by_type)
        .map(([type, count]) => `${type}=${count}`)
        .join(", ")}`,
    );
    console.log(passed ? "PASS: generated label coverage is complete." : "FAIL: generated label coverage has gaps.");
  }

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
