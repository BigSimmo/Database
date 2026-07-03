import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import { recordToRow, type RegistryRecordKind } from "@/lib/registry-records";
import { serviceRecords } from "@/lib/services";
import { formRecords } from "@/lib/forms";
import type { ServiceRecord } from "@/lib/services";

loadEnvConfig(process.cwd());

type SeedArgs = {
  ownerId?: string;
  kind: RegistryRecordKind | "all";
  write: boolean;
  confirmed: boolean;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = {
    ownerId: process.env.LOCAL_NO_AUTH_OWNER_ID,
    kind: "all",
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
    if (token === "--kind") {
      const value = argv[index + 1];
      if (value !== "service" && value !== "form" && value !== "all") {
        throw new Error(`Invalid --kind value: ${value ?? "(missing)"}. Use service | form | all.`);
      }
      args.kind = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function seedSets(kind: SeedArgs["kind"]): Array<{ kind: RegistryRecordKind; records: ServiceRecord[] }> {
  const sets: Array<{ kind: RegistryRecordKind; records: ServiceRecord[] }> = [];
  if (kind === "service" || kind === "all") sets.push({ kind: "service", records: serviceRecords });
  if (kind === "form" || kind === "all") sets.push({ kind: "form", records: formRecords });
  return sets;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerId) {
    throw new Error("No owner id. Pass --owner-id <uuid> or set LOCAL_NO_AUTH_OWNER_ID.");
  }

  const sets = seedSets(args.kind);
  const rows = sets.flatMap((set) => set.records.map((record) => recordToRow(record, args.ownerId!, set.kind)));

  console.log(`[registry:seed] owner ${args.ownerId}`);
  for (const row of rows) {
    console.log(
      `  ${row.kind.padEnd(7)} ${String(row.slug).padEnd(42)} source_status=${row.source_status} validation_status=${row.validation_status}`,
    );
  }
  console.log(
    `[registry:seed] ${rows.length} records (${sets.map((s) => `${s.records.length} ${s.kind}`).join(", ")})`,
  );

  if (!args.write) {
    console.log("[registry:seed] Dry run. Re-run with --write --confirm to upsert.");
    return;
  }
  if (!args.confirmed) {
    const proceed = await confirm(`Upsert ${rows.length} registry records for owner ${args.ownerId}?`);
    if (!proceed) {
      console.log("[registry:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();

  // Preserve governance that was reviewed after seeding: a reseed for fixture
  // copy changes must not downgrade source_status / validation_status /
  // last_reviewed_at / review_due_at back to the fixture-derived defaults.
  const { data: existing, error: existingError } = await supabase
    .from("clinical_registry_records")
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
    console.log(`[registry:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase
    .from("clinical_registry_records")
    .upsert(upsertRows, { onConflict: "owner_id,kind,slug" });
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  const { count, error: countError } = await supabase
    .from("clinical_registry_records")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", args.ownerId);
  if (countError) {
    console.warn(`[registry:seed] Upsert succeeded but count check failed: ${countError.message}`);
  } else {
    console.log(`[registry:seed] Done. Owner now has ${count ?? "?"} registry records.`);
  }
}

main().catch((error) => {
  console.error(`[registry:seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
