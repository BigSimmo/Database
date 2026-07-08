import { loadEnvConfig } from "@next/env";
import type { Json } from "@/lib/supabase/database.types";
import { deriveUnknownStatus } from "@/lib/unknown-status-derivation";

loadEnvConfig(process.cwd());

/**
 * Status-derivation pass for documents left at `document_status = "unknown"`.
 *
 * Background: `scripts/backfill-source-metadata.ts` derives `document_status`
 * from an *explicit* review date found in the source text (or, for BMJ, a
 * recent `Last updated`). A residual set of documents carry a publisher and a
 * `publication_date` but no parseable review date, so they stay "unknown" and
 * trip the retrieval governance warning ("Review status unknown").
 *
 * This pass resolves ONLY the sub-set where a status can be defensibly inferred:
 * a document with a `publication_date` and no explicit review date is assigned a
 * review date of `publication_date + REVIEW_CYCLE_YEARS` (WA Health documents
 * carry a standard review cycle, default 3 years), then classified current /
 * review_due against that inferred date.
 *
 * Deliberately conservative:
 *  - Only touches `document_status = "unknown"`; never overwrites a derived status.
 *  - Only touches docs WITH a `publication_date`; date-less unknowns stay unknown
 *    (there is nothing to infer from).
 *  - Skips future/implausible publication dates (likely mis-extractions) so a bad
 *    date can't fabricate a "current" status.
 *  - The inferred review date is flagged (`review_date_inferred: true`) and the
 *    basis recorded, so every change is auditable and reversible by querying the
 *    version stamp.
 *
 * This encodes a policy assumption (the standard review cycle). Run `--dry-run`
 * (default) first and confirm the split before `--apply`.
 */

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  metadata: Record<string, unknown> | null;
};

const APPLY = process.argv.includes("--apply");
const DERIVATION_VERSION = "unknown_status_cycle_v1";

function reviewCycleYears() {
  const raw = process.env.REVIEW_CYCLE_YEARS;
  if (!raw) return 3;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error(`Invalid REVIEW_CYCLE_YEARS: ${raw} (expected integer 1-10)`);
  }
  return value;
}

const REVIEW_CYCLE_YEARS = reviewCycleYears();
const NOW = new Date();

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

async function loadUnknownDocuments() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const documents: DocumentRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,file_name,metadata")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as DocumentRow[];
    for (const row of rows) {
      const status = metadataRecord(row.metadata).document_status;
      if ((status ?? "unknown") === "unknown") documents.push(row);
    }
    if (rows.length < pageSize) break;
  }
  return documents;
}

async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const documents = await loadUnknownDocuments();

  const derived: Array<{
    document: DocumentRow;
    metadata: Record<string, unknown>;
    reviewDate: string;
    status: string;
  }> = [];
  const skipCounts: Record<string, number> = {};

  for (const document of documents) {
    const metadata = metadataRecord(document.metadata);
    const result = deriveUnknownStatus(metadata.publication_date, { reviewCycleYears: REVIEW_CYCLE_YEARS, now: NOW });
    if (result.kind === "skip") {
      skipCounts[result.reason] = (skipCounts[result.reason] ?? 0) + 1;
      continue;
    }
    metadata.document_status = result.status;
    metadata.review_date = result.reviewDate;
    metadata.review_date_inferred = true;
    metadata.unknown_status_derivation_version = DERIVATION_VERSION;
    metadata.unknown_status_derivation_basis = `inferred from publication_date + ${REVIEW_CYCLE_YEARS}-year standard review cycle; no explicit review date in source`;
    metadata.unknown_status_derived_at = new Date().toISOString();
    derived.push({ document, metadata, reviewDate: result.reviewDate, status: result.status });
  }

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    review_cycle_years: REVIEW_CYCLE_YEARS,
    unknown_documents_seen: documents.length,
    documents_derived: derived.length,
    derived_status_counts: derived.reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {}),
    left_unknown: skipCounts,
    sample: derived.slice(0, 15).map((item) => ({
      title: item.document.title,
      file_name: item.document.file_name,
      inferred_review_date: item.reviewDate,
      document_status: item.status,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) return;

  for (const item of derived) {
    const { error } = await supabase
      .from("documents")
      .update({ metadata: item.metadata as Json })
      .eq("id", item.document.id);
    if (error) throw new Error(`Failed to update ${item.document.file_name}: ${error.message}`);
  }
  console.log(`Derived document_status for ${derived.length} previously-unknown documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
