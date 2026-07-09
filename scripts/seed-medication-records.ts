import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import { buildMedicationSeedRows } from "@/lib/medication-seed";
import type { MedicationRecordRow } from "@/lib/medication-records";

loadEnvConfig(process.cwd());

type SeedArgs = {
  ownerId?: string;
  write: boolean;
  confirmed: boolean;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function loadRegistryCorpus() {
  return import("@/lib/registry-corpus");
}

function parseArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = {
    ownerId: process.env.LOCAL_NO_AUTH_OWNER_ID,
    write: false,
    confirmed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirmed = true;
      continue;
    }
    if (token === "--owner-id") {
      args.ownerId = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function main() {
  const { embedMedicationRows, embedReloadedOwnerRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerId) {
    throw new Error("No owner id. Pass --owner-id <uuid> or set LOCAL_NO_AUTH_OWNER_ID.");
  }

  const rows = buildMedicationSeedRows(args.ownerId);

  console.log(`[medications:seed] owner ${args.ownerId}`);
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
    const proceed = await confirm(`Upsert ${rows.length} medication records for owner ${args.ownerId}?`);
    if (!proceed) {
      console.log("[medications:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("medication_records")
    .select("slug, source_status, validation_status, last_reviewed_at, review_due_at")
    .eq("owner_id", args.ownerId);
  if (existingError) {
    throw new Error(`Could not read existing governance: ${existingError.message}`);
  }
  const governanceBySlug = new Map((existing ?? []).map((row) => [row.slug, row] as const));
  let preserved = 0;
  const upsertRows = rows.map((row) => {
    const prior = governanceBySlug.get(row.slug);
    if (!prior) return row;
    const hasReviewedGovernance =
      Boolean(prior.last_reviewed_at) ||
      prior.validation_status === "locally_reviewed" ||
      prior.validation_status === "approved";
    if (!hasReviewedGovernance) return row;
    preserved += 1;
    return {
      ...row,
      source_status: prior.source_status,
      validation_status: prior.validation_status,
      last_reviewed_at: prior.last_reviewed_at,
      review_due_at: prior.review_due_at,
    };
  });
  if (preserved > 0) {
    console.log(`[medications:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase.from("medication_records").upsert(upsertRows, { onConflict: "owner_id,slug" });
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  const { count, error: countError } = await supabase
    .from("medication_records")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", args.ownerId);
  if (countError) {
    console.warn(`[medications:seed] Upsert succeeded but count check failed: ${countError.message}`);
  } else {
    console.log(`[medications:seed] Done. Owner now has ${count ?? "?"} medication records.`);
  }

  if (registryCorpusEmbeddingEnabled()) {
    const chunkCount = await embedReloadedOwnerRows(
      supabase.from("medication_records").select("*").eq("owner_id", args.ownerId),
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
