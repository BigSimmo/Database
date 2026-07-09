import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import { buildDefaultDifferentialRows, loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import type { DifferentialRecordRow } from "@/lib/differential-records";

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
  const { embedDifferentialRows, embedReloadedOwnerRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerId) {
    throw new Error("No owner id. Pass --owner-id <uuid> or set LOCAL_NO_AUTH_OWNER_ID.");
  }

  const snapshot = loadDifferentialSnapshot();
  const rows = buildDefaultDifferentialRows(args.ownerId);

  console.log(`[differentials:seed] owner ${args.ownerId}`);
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
    const proceed = await confirm(`Upsert ${rows.length} differential records for owner ${args.ownerId}?`);
    if (!proceed) {
      console.log("[differentials:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("differential_records")
    .select("kind, slug, source_status, validation_status, last_reviewed_at, review_due_at")
    .eq("owner_id", args.ownerId);
  if (existingError) {
    throw new Error(`Could not read existing governance: ${existingError.message}`);
  }

  const governanceByKey = new Map((existing ?? []).map((row) => [`${row.kind}:${row.slug}`, row] as const));
  let preserved = 0;
  const upsertRows = rows.map((row) => {
    const prior = governanceByKey.get(`${row.kind}:${row.slug}`);
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
    console.log(`[differentials:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase.from("differential_records").upsert(upsertRows, {
    onConflict: "owner_id,kind,slug",
  });
  if (error) throw new Error(`Upsert failed: ${error.message}`);

  const { count, error: countError } = await supabase
    .from("differential_records")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", args.ownerId);
  if (countError) {
    console.warn(`[differentials:seed] Upsert succeeded but count check failed: ${countError.message}`);
  } else {
    console.log(`[differentials:seed] Done. Owner now has ${count ?? "?"} differential records.`);
  }

  if (registryCorpusEmbeddingEnabled()) {
    const chunkCount = await embedReloadedOwnerRows(
      supabase.from("differential_records").select("*").eq("owner_id", args.ownerId),
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
