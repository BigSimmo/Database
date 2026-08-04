import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import {
  loadAdminClient,
  loadRegistryCorpus,
  parseSeedArgs,
  preserveReviewedGovernance,
  reportOwnerRecordCount,
  requireOwnerId,
  type SeedArgs,
} from "./lib/seed-record-cli";
import { buildDefaultDifferentialRows, loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import type { DifferentialRecordRow } from "@/lib/differential-records";
import { staleSeededPresentations } from "@/lib/differential-seed";

loadEnvConfig(process.cwd());

async function main() {
  const { embedDifferentialRows, embedReloadedOwnerRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  const args = parseSeedArgs<SeedArgs>(process.argv.slice(2), {});
  const ownerId = requireOwnerId(args);

  const snapshot = loadDifferentialSnapshot();
  const rows = buildDefaultDifferentialRows(ownerId);

  console.log(`[differentials:seed] owner ${ownerId}`);
  console.log(
    `[differentials:seed] ${snapshot.presentations.length} presentations, ${snapshot.diagnoses.length} diagnoses (${rows.length} rows)`,
  );
  for (const row of rows.slice(0, 12)) {
    console.log(
      `  ${row.kind.padEnd(12)} ${String(row.slug).padEnd(42)} source_status=${row.source_status} validation_status=${row.validation_status}`,
    );
  }
  if (rows.length > 12) console.log(`  ... and ${rows.length - 12} more`);

  if (!args.write) {
    console.log("[differentials:seed] Dry run. Re-run with --write --confirm to upsert.");
    return;
  }
  if (!args.confirmed) {
    const proceed = await confirm(`Upsert ${rows.length} differential records for owner ${ownerId}?`);
    if (!proceed) {
      console.log("[differentials:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("differential_records")
    .select("id, kind, slug, source_status, validation_status, last_reviewed_at, review_due_at")
    .eq("owner_id", ownerId);
  if (existingError) {
    throw new Error(`Could not read existing governance: ${existingError.message}`);
  }

  const { rows: upsertRows, preserved } = preserveReviewedGovernance({
    rows,
    existing: existing ?? [],
    rowKey: (row) => `${row.kind}:${row.slug}`,
    priorKey: (prior) => `${prior.kind}:${prior.slug}`,
  });
  if (preserved > 0) {
    console.log(`[differentials:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase.from("differential_records").upsert(upsertRows, {
    onConflict: "owner_id,kind,slug",
  });
  if (error) throw new Error(`Upsert failed: ${error.message}`);

  // Upserts never delete, so presentation rows the snapshot no longer produces
  // (e.g. the removed "urgency-urgent" export artifact) linger for
  // already-seeded owners; prune them and their registry corpus documents.
  const stale = staleSeededPresentations(existing ?? []);
  if (stale.length > 0) {
    const { differentialCorpusDocumentId } = await loadRegistryCorpus();
    console.log(
      `[differentials:seed] Removing ${stale.length} stale presentation row(s) no longer in the snapshot: ${stale
        .map((row) => row.slug)
        .join(", ")}`,
    );
    const { error: staleCorpusError } = await supabase
      .from("documents")
      .delete()
      .in(
        "id",
        stale.map((row) => differentialCorpusDocumentId(row.id)),
      );
    if (staleCorpusError) throw new Error(`Stale corpus document cleanup failed: ${staleCorpusError.message}`);
    const { error: staleRowError } = await supabase
      .from("differential_records")
      .delete()
      .in(
        "id",
        stale.map((row) => row.id),
      );
    if (staleRowError) throw new Error(`Stale presentation row cleanup failed: ${staleRowError.message}`);
  }

  await reportOwnerRecordCount({
    supabase,
    table: "differential_records",
    ownerId,
    logPrefix: "[differentials:seed]",
    noun: "differential records",
  });

  if (registryCorpusEmbeddingEnabled()) {
    const chunkCount = await embedReloadedOwnerRows(
      supabase.from("differential_records").select("*").eq("owner_id", ownerId),
      (rows) => embedDifferentialRows(supabase, rows as DifferentialRecordRow[]),
      "differential",
    );
    console.log(`[differentials:seed] Embedded ${chunkCount} registry corpus chunk(s).`);
  }
}

main().catch((error) => {
  console.error(`[differentials:seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
