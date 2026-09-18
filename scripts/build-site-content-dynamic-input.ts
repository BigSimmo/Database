/**
 * Assemble the `--dynamic` input `sync-site-content-corpus.ts` needs, from an operator export.
 *
 * WHERE THIS SITS. Publication planning takes three inputs. `--manifest` is built by
 * `build-site-content-manifest.ts`. `--reconciliation` is built by
 * `build-site-content-reconciliation-plan.ts`. This builds the third, `--dynamic`, whose
 * `existingReleaseRecords` must be the exact population the public site serves today.
 *
 * WHY IT READS A FILE AND NOT THE DATABASE. `service_role` has no SELECT on any of the six
 * site-content control-plane tables — verified 2026-09-18 with `has_table_privilege()`, and
 * deliberate: the control plane is reached through its RPCs, not by a key an application holds.
 * So the privileged read stays with an operator running
 * `scripts/sql/operator-export-site-content-population.sql` in the Supabase SQL editor, and this
 * script consumes the file. It holds no credentials and opens no connection.
 *
 * WHAT IT DOES NOT DO, AND THIS IS THE ORDERING THAT MATTERS.
 * It does not populate `records` — the dynamic-registry population a publication would adopt.
 * Those are projections of owner-scoped rows, and a projection cannot be built until the
 * reconciliation has decided which candidate is canonical for each logical group and what its
 * public identity is (`adoptCanonicalRegistryProjection` takes a group plus its trusted snapshot).
 * So the real order is:
 *
 *   1. operator export            -> this script, with --records-empty, to size and validate
 *   2. reconciliation plan        -> build-site-content-reconciliation-plan.ts
 *   3. administrator records it   -> POST record_reconciliation (owner only; service_role refused)
 *   4. dynamic input WITH records -> this script again, with --records <projections.json>
 *   5. plan                       -> sync-site-content-corpus.ts (dry run first)
 *
 * Steps 1 and 2 are offline and safe. Step 3 is the owner's and cannot be automated. This script
 * therefore refuses to invent `records`: passing neither --records nor --records-empty is an error
 * rather than a silent empty array, because an empty population plans a publication that retires
 * everything.
 *
 * USAGE
 *   node scripts/run-tsx.mjs scripts/build-site-content-dynamic-input.ts \
 *     --population export.json (--records projections.json | --records-empty) \
 *     [--generation-id <id>] [--target-change-epoch <n>] --out dynamic-input.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EMBEDDING = {
  // Matches tests/fixtures/site-content/dynamic-empty.json and the worker's own fingerprint. The
  // epoch-zero release carries 'bootstrap-no-embedding-1536-v1' and no vectors at all, so no
  // record can reuse one and the first real publication embeds everything in scope.
  model: "text-embedding-3-small",
  dimensions: 1536,
  fingerprint: "openai-text-embedding-3-small-1536-v1",
} as const;

type PopulationExport = {
  version: "site-content-population-export-v1";
  activeReleaseId: string | null;
  activeReleaseDigest: string | null;
  changeEpoch: string;
  servedChangeEpoch: string;
  initialized: boolean;
  recordCount: number;
  existingReleaseRecords: Array<Record<string, unknown>>;
};

type Options = {
  population: string;
  records?: string;
  recordsEmpty: boolean;
  generationId?: string;
  targetChangeEpoch?: string;
  out: string;
};

function parseOptions(argv: readonly string[]): Options {
  const options: Partial<Options> & { recordsEmpty: boolean } = { recordsEmpty: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--records-empty") {
      options.recordsEmpty = true;
      continue;
    }
    const value = argv[(index += 1)];
    if (flag === "--population") options.population = value;
    else if (flag === "--records") options.records = value;
    else if (flag === "--generation-id") options.generationId = value;
    else if (flag === "--target-change-epoch") options.targetChangeEpoch = value;
    else if (flag === "--out") options.out = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.population) throw new Error("--population <export.json> is required.");
  if (!options.out) throw new Error("--out <dynamic-input.json> is required.");
  if (!options.records && !options.recordsEmpty) {
    throw new Error(
      "Pass --records <projections.json>, or --records-empty to state deliberately that the dynamic " +
        "population is empty. An empty `records` plans a publication that retires everything, so it is " +
        "never the default.",
    );
  }
  if (options.records && options.recordsEmpty) throw new Error("--records and --records-empty are exclusive.");
  return options as Options;
}

function json(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

/** Every field `ExistingSiteContentReleaseRecord` declares. Copied, never derived. */
const EXISTING_KEYS = [
  "logicalId",
  "targetPublicationId",
  "publicationFingerprint",
  "contentHash",
  "governanceFingerprint",
  "lineageFingerprint",
  "publicMetadataFingerprint",
  "normalizedText",
  "documentId",
  "chunkId",
  "embeddingModel",
  "embeddingDimensions",
  "embeddingFingerprint",
  "embedding",
] as const;

function assertPopulationExport(value: unknown): asserts value is PopulationExport {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Population export must be an object.");
  const input = value as Record<string, unknown>;
  if (input.version !== "site-content-population-export-v1") {
    throw new Error(
      "Population export has the wrong version; regenerate it with scripts/sql/operator-export-site-content-population.sql.",
    );
  }
  if (!Array.isArray(input.existingReleaseRecords))
    throw new Error("Population export carries no existingReleaseRecords array.");
  if (typeof input.recordCount !== "number" || input.recordCount !== input.existingReleaseRecords.length) {
    // The export states its own count; a mismatch means the population moved mid-read, and planning
    // against a shifting population is exactly what must not happen.
    throw new Error(
      `Population export is internally inconsistent: recordCount=${String(input.recordCount)} but ` +
        `${input.existingReleaseRecords.length} records. Re-run the export.`,
    );
  }
  for (const [index, record] of (input.existingReleaseRecords as Array<Record<string, unknown>>).entries()) {
    const keys = Object.keys(record).sort();
    const expected = [...EXISTING_KEYS].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(
        `existingReleaseRecords[${index}] (${String(record.logicalId)}) does not match ` +
          `ExistingSiteContentReleaseRecord. Got ${keys.join(",")}.`,
      );
    }
  }
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const population = json(options.population);
  assertPopulationExport(population);

  const records = options.recordsEmpty ? [] : (json(options.records!) as unknown[]);
  if (!Array.isArray(records)) throw new Error("--records must contain a JSON array of source records.");

  // Initial adoption is a property of the live control plane, not a flag a caller chooses: the
  // planner requires --reconciliation exactly when it is true, so getting it wrong fails loudly
  // rather than quietly planning the wrong kind of publication.
  const initialAdoption = population.initialized !== true;

  // The next epoch, unless the operator pins one. Publishing advances the singleton epoch once.
  const targetChangeEpoch = options.targetChangeEpoch ?? String(BigInt(population.changeEpoch) + 1n);

  const dynamicInput = {
    version: "site-content-dynamic-input-v1",
    initialAdoption,
    targetChangeEpoch,
    generationId: options.generationId ?? `adoption-${population.activeReleaseId ?? "none"}-${targetChangeEpoch}`,
    embedding: { ...EMBEDDING },
    records,
    existingReleaseRecords: population.existingReleaseRecords,
  };

  writeFileSync(resolve(options.out), `${JSON.stringify(dynamicInput, null, 2)}\n`);

  console.log(`Wrote ${options.out}`);
  console.log(`  activeReleaseId        ${population.activeReleaseId ?? "(none)"}`);
  console.log(`  initialized            ${population.initialized}  -> initialAdoption=${initialAdoption}`);
  console.log(`  changeEpoch            ${population.changeEpoch} -> targetChangeEpoch=${targetChangeEpoch}`);
  console.log(`  existingReleaseRecords ${population.existingReleaseRecords.length}`);
  console.log(
    `  records                ${records.length}${options.recordsEmpty ? "  (--records-empty, stated deliberately)" : ""}`,
  );
  if (initialAdoption) {
    console.log("");
    console.log("  initialAdoption is true, so sync-site-content-corpus.ts will REQUIRE --reconciliation.");
    console.log("  Build it with scripts/build-site-content-reconciliation-plan.ts.");
  }
  if (records.length === 0) {
    console.log("");
    console.log("  NOTE: records is empty. A plan built from this retires the published population rather");
    console.log("  than carrying it forward. That is correct only for a deliberate teardown. For adoption,");
    console.log("  supply --records once the reconciliation has been recorded (step 3 of the header).");
  }
}

try {
  main();
} catch (error) {
  console.error(`build-site-content-dynamic-input: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
