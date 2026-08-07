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
import { buildMedicationSeedRows } from "@/lib/medication-seed";
import type { MedicationRecordRow } from "@/lib/medication-records";

loadEnvConfig(process.cwd());

async function main() {
  const { embedMedicationRows, embedReloadedOwnerRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  const args = parseSeedArgs<SeedArgs>(process.argv.slice(2), {});
  const ownerId = requireOwnerId(args);

  const rows = buildMedicationSeedRows(ownerId);

  console.log(`[medications:seed] owner ${ownerId}`);
  for (const row of rows.slice(0, 10)) {
    console.log(`  ${String(row.slug).padEnd(42)} ${row.name}`);
  }
  if (rows.length > 10) {
    console.log(`  ... ${rows.length - 10} more`);
  }
  console.log(`[medications:seed] ${rows.length} medications`);

  if (!args.write) {
    console.log("[medications:seed] Dry run. Re-run with --write --confirm to upsert.");
    return;
  }
  if (!args.confirmed) {
    const proceed = await confirm(`Upsert ${rows.length} medication records for owner ${ownerId}?`);
    if (!proceed) {
      console.log("[medications:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("medication_records")
    .select("slug, source_status, validation_status, last_reviewed_at, review_due_at")
    .eq("owner_id", ownerId);
  if (existingError) {
    throw new Error(`Could not read existing governance: ${existingError.message}`);
  }
  const { rows: upsertRows, preserved } = preserveReviewedGovernance({
    rows,
    existing: existing ?? [],
    rowKey: (row) => row.slug,
    priorKey: (prior) => prior.slug,
  });
  if (preserved > 0) {
    console.log(`[medications:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase.from("medication_records").upsert(upsertRows, { onConflict: "owner_id,slug" });
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  await reportOwnerRecordCount({
    supabase,
    table: "medication_records",
    ownerId,
    logPrefix: "[medications:seed]",
    noun: "medication records",
  });

  if (registryCorpusEmbeddingEnabled()) {
    const chunkCount = await embedReloadedOwnerRows(
      supabase.from("medication_records").select("*").eq("owner_id", ownerId),
      (rows) => embedMedicationRows(supabase, rows as MedicationRecordRow[]),
      "medication",
    );
    console.log(`[medications:seed] Embedded ${chunkCount} registry corpus chunk(s).`);
  }
}

main().catch((error) => {
  console.error(`[medications:seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
