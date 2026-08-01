import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import {
  loadAdminClient,
  loadRegistryCorpus,
  parseSeedArgs,
  preserveReviewedGovernance,
  reportOwnerRecordCount,
  requireOwnerId,
  type SeedArgs as BaseSeedArgs,
} from "./lib/seed-record-cli";
import type { RegistryRecordRow } from "@/lib/registry-records";
import { type RegistryRecordKind } from "@/lib/registry-records";
import { buildDefaultRegistryRows, defaultRegistryRecords } from "@/lib/registry-seed";
import type { ServiceRecord } from "@/lib/services";

loadEnvConfig(process.cwd());

type SeedArgs = BaseSeedArgs & {
  kind: RegistryRecordKind | "all";
};

function seedSets(kind: SeedArgs["kind"]): Array<{ kind: RegistryRecordKind; records: ServiceRecord[] }> {
  const kinds: RegistryRecordKind[] = kind === "all" ? ["service", "form"] : [kind];
  return kinds.map((seedKind) => ({ kind: seedKind, records: defaultRegistryRecords(seedKind) }));
}

async function main() {
  const { embedClinicalRegistryRows, embedReloadedOwnerRows, registryCorpusEmbeddingEnabled } =
    await loadRegistryCorpus();
  const args = parseSeedArgs<SeedArgs>(
    process.argv.slice(2),
    { kind: "all" },
    {
      "--kind": (value, parsed) => {
        if (value !== "service" && value !== "form" && value !== "all") {
          throw new Error(`Invalid --kind value: ${value ?? "(missing)"}. Use service | form | all.`);
        }
        parsed.kind = value;
      },
    },
  );
  const ownerId = requireOwnerId(args);

  const sets = seedSets(args.kind);
  const rows = sets.flatMap((set) => buildDefaultRegistryRows(ownerId, set.kind));

  console.log(`[registry:seed] owner ${ownerId}`);
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
    const proceed = await confirm(`Upsert ${rows.length} registry records for owner ${ownerId}?`);
    if (!proceed) {
      console.log("[registry:seed] Aborted.");
      return;
    }
  }

  const supabase = await loadAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("clinical_registry_records")
    .select("kind, slug, source_status, validation_status, last_reviewed_at, review_due_at")
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
    console.log(`[registry:seed] Preserving reviewed governance on ${preserved} existing record(s).`);
  }

  const { error } = await supabase
    .from("clinical_registry_records")
    .upsert(upsertRows, { onConflict: "owner_id,kind,slug" });
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  await reportOwnerRecordCount({
    supabase,
    table: "clinical_registry_records",
    ownerId,
    logPrefix: "[registry:seed]",
    noun: "registry records",
  });

  if (registryCorpusEmbeddingEnabled()) {
    const kinds: RegistryRecordKind[] = args.kind === "all" ? ["service", "form"] : [args.kind];
    const chunkCount = await embedReloadedOwnerRows(
      supabase.from("clinical_registry_records").select("*").eq("owner_id", ownerId).in("kind", kinds),
      (rows) => embedClinicalRegistryRows(supabase, rows as RegistryRecordRow[]),
      "registry",
    );
    console.log(`[registry:seed] Embedded ${chunkCount} registry corpus chunk(s).`);
  }
}

main().catch((error) => {
  console.error(`[registry:seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
