import { loadEnvConfig } from "@next/env";

import { confirm } from "./cli-utils";
import type { DifferentialRecordRow } from "@/lib/differential-records";
import type { MedicationRecordRow } from "@/lib/medication-records";
import type { RegistryRecordKind, RegistryRecordRow } from "@/lib/registry-records";

loadEnvConfig(process.cwd());

type EmbedKind = RegistryRecordKind | "medication" | "differential" | "all";

type Args = {
  ownerId?: string;
  kind: EmbedKind;
  slug?: string;
  write: boolean;
  confirmed: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
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

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    if (token === "--owner-id") args.ownerId = value;
    else if (token === "--slug") args.slug = value;
    else if (token === "--kind") {
      if (!["service", "form", "medication", "differential", "all"].includes(value)) {
        throw new Error("--kind must be service, form, medication, differential, or all.");
      }
      args.kind = value as EmbedKind;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
    index += 1;
  }

  return args;
}

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function registryKinds(kind: EmbedKind): RegistryRecordKind[] {
  if (kind === "all") return ["service", "form"];
  if (kind === "service" || kind === "form") return [kind];
  return [];
}

async function loadRegistryRows(supabase: Awaited<ReturnType<typeof loadAdminClient>>, args: Args, ownerId: string) {
  const kinds = registryKinds(args.kind);
  if (kinds.length === 0) return [] as RegistryRecordRow[];
  let query = supabase.from("clinical_registry_records").select("*").eq("owner_id", ownerId).in("kind", kinds);
  if (args.slug) query = query.eq("slug", args.slug);
  const { data, error } = await query.order("kind").order("title");
  if (error) throw new Error(`Could not load registry records: ${error.message}`);
  return (data ?? []) as RegistryRecordRow[];
}

async function loadMedicationRows(supabase: Awaited<ReturnType<typeof loadAdminClient>>, args: Args, ownerId: string) {
  if (args.kind !== "all" && args.kind !== "medication") return [] as MedicationRecordRow[];
  let query = supabase.from("medication_records").select("*").eq("owner_id", ownerId);
  if (args.slug) query = query.eq("slug", args.slug);
  const { data, error } = await query.order("name");
  if (error) throw new Error(`Could not load medication records: ${error.message}`);
  return (data ?? []) as MedicationRecordRow[];
}

async function loadDifferentialRows(
  supabase: Awaited<ReturnType<typeof loadAdminClient>>,
  args: Args,
  ownerId: string,
) {
  if (args.kind !== "all" && args.kind !== "differential") return [] as DifferentialRecordRow[];
  let query = supabase.from("differential_records").select("*").eq("owner_id", ownerId);
  if (args.slug) query = query.eq("slug", args.slug);
  const { data, error } = await query.order("kind").order("title");
  if (error) throw new Error(`Could not load differential records: ${error.message}`);
  return (data ?? []) as DifferentialRecordRow[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ownerId = args.ownerId;
  if (!ownerId) throw new Error("No owner id. Pass --owner-id <uuid> or set LOCAL_NO_AUTH_OWNER_ID.");

  const {
    clinicalRegistryRowsToCorpusEntries,
    differentialRowsToCorpusEntries,
    embedClinicalRegistryRows,
    embedDifferentialRows,
    embedMedicationRows,
    medicationRowsToCorpusEntries,
    registryCorpusEmbeddingEnabled,
  } = await import("@/lib/registry-corpus");

  const supabase = await loadAdminClient();
  const [registryRows, medicationRows, differentialRows] = await Promise.all([
    loadRegistryRows(supabase, args, ownerId),
    loadMedicationRows(supabase, args, ownerId),
    loadDifferentialRows(supabase, args, ownerId),
  ]);
  const registryEntries = clinicalRegistryRowsToCorpusEntries(registryRows);
  const medicationEntries = medicationRowsToCorpusEntries(medicationRows);
  const differentialEntries = differentialRowsToCorpusEntries(differentialRows);
  const total = registryEntries.length + medicationEntries.length + differentialEntries.length;

  console.log(`[registry:embed] owner ${ownerId}`);
  console.log(
    `[registry:embed] loaded ${registryEntries.length} service/form, ${medicationEntries.length} medication, ${differentialEntries.length} differential entr${total === 1 ? "y" : "ies"}`,
  );
  for (const entry of [...registryEntries, ...medicationEntries, ...differentialEntries].slice(0, 20)) {
    console.log(`  ${entry.kind.padEnd(12)} ${entry.slug.padEnd(42)} ${entry.title}`);
  }
  if (total > 20) console.log(`  ... ${total - 20} more`);

  if (!args.write) {
    console.log(
      "[registry:embed] Dry run. Re-run with --write --confirm and RAG_REGISTRY_CORPUS_EMBEDDING=true to write embeddings.",
    );
    return;
  }
  if (!registryCorpusEmbeddingEnabled()) {
    throw new Error("Refusing to write registry corpus embeddings unless RAG_REGISTRY_CORPUS_EMBEDDING=true.");
  }
  if (!args.confirmed) {
    const proceed = await confirm(`Embed and upsert ${total} registry corpus entr${total === 1 ? "y" : "ies"}?`);
    if (!proceed) {
      console.log("[registry:embed] Aborted.");
      return;
    }
  }

  const registryResult = await embedClinicalRegistryRows(supabase, registryRows);
  const medicationResult = await embedMedicationRows(supabase, medicationRows);
  const differentialResult = await embedDifferentialRows(supabase, differentialRows);
  const chunkCount = registryResult.chunkCount + medicationResult.chunkCount + differentialResult.chunkCount;
  console.log(`[registry:embed] Done. Upserted ${chunkCount} registry corpus chunk(s).`);
}

main().catch((error) => {
  console.error(`[registry:embed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
