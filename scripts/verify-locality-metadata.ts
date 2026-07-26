import * as nextEnv from "@next/env";
import { auditSourceAuthorityDocuments, type SourceAuthorityDocument } from "@/lib/source-authority-metadata";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function asSourceAuthorityDocument(row: {
  id?: string | null;
  title?: string | null;
  file_name?: string | null;
  source_path?: string | null;
  metadata?: unknown;
}): SourceAuthorityDocument {
  return {
    id: row.id ?? undefined,
    title: row.title ?? "",
    file_name: row.file_name ?? "",
    source_path: row.source_path ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

export async function main() {
  if (loadEnvConfig) {
    loadEnvConfig(process.cwd());
  }

  const supabase = await loadAdminClient();
  const documents: SourceAuthorityDocument[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,file_name,source_path,status,metadata")
      .eq("status", "indexed")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    documents.push(...(data ?? []).map(asSourceAuthorityDocument));
    if (!data || data.length < pageSize) break;
  }

  const report = auditSourceAuthorityDocuments(documents);

  if (!report.passed) {
    console.error("FAIL: Source authority metadata verification failed.");
    if (report.missing_australian_locality_count > 0) {
      console.error(`- Missing Australian locality metadata: ${report.missing_australian_locality_count} documents`);
    }
    if (report.authority_conflict_count > 0) {
      console.error(`- Authority conflicts: ${report.authority_conflict_count} documents`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS: Source authority metadata verification passed.");
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (process.argv[1] && process.argv[1].endsWith("verify-locality-metadata.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
