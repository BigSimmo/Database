/**
 * Build the `--reconciliation` input initial adoption requires, and refuse when a human must decide.
 *
 * WHERE THIS SITS. `sync-site-content-corpus.ts` demands `--reconciliation` exactly when the
 * control plane is uninitialised. The file must be an exact, unique, sorted population: one
 * disposition per locked source row, one trusted canonical-public snapshot per logical group,
 * counts that match, and two digests the database recomputes and rejects on mismatch
 * (`assertSiteContentReconciliationInput`, and again in `record_site_content_reconciliation_plan`).
 *
 * WHAT IT DECIDES, AND WHAT IT REFUSES TO DECIDE. `buildRegistryReconciliationReport` triages each
 * logical group into `adoptable`, `identical_duplicates` or
 * `divergent_requires_administrator_review`. The first two are mechanical and this emits them:
 * `adopt` for the canonical candidate, `identical_duplicate` for provably identical siblings. The
 * third is a clinical judgement about which text becomes public, so this script **stops** and lists
 * them rather than guessing. Publishing the wrong record is not a defect the database can catch:
 * it validates that a plan is self-consistent, never that it is the one you meant.
 *
 * `retire` is likewise never emitted automatically. Retiring a source row is a decision to stop
 * publishing something, and it has to be stated, not inferred from a hash difference.
 *
 * WHY THE TRUSTED SNAPSHOT IS NOT DERIVED FROM THE CANDIDATE. Adoption validates the candidate
 * against evidence acquired separately from the public projection — that is the whole point of the
 * word "trusted" in the type. So the snapshots here are built from the published population
 * (`--population`, the operator export), never from the owner rows being adopted.
 *
 * NOTE ON `publicRecordId`. In a reconciliation plan the validator requires
 * `snapshot.publicRecordId === snapshot.logicalId`. That is a different convention from
 * `expectedCanonicalPublicRegistrySnapshot`, which keys on the candidate's own record id. Do not
 * copy one into the other.
 *
 * USAGE
 *   node scripts/run-tsx.mjs scripts/build-site-content-reconciliation-plan.ts \
 *     --population export.json [--kind service] [--batch-size 100] --out reconciliation.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { clinicalRegistryRowsToCorpusEntries } from "@/lib/registry-corpus";
import type { RegistryRecordRow } from "@/lib/registry-records";
import { dynamicLogicalId } from "@/lib/site-content/adapters";
import {
  buildRegistryReconciliationReport,
  type RegistryReconciliationCandidate,
} from "@/lib/site-content/adapters/registry";
import {
  assertSiteContentReconciliationInput,
  reconciliationHash,
} from "@/lib/site-content/site-content-reconciliation";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";

type Options = { population: string; kind: "service" | "form"; batchSize: number; out: string };

function parseOptions(argv: readonly string[]): Options {
  const options: Partial<Options> = { kind: "service", batchSize: 100 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[(index += 1)];
    if (flag === "--population") options.population = value;
    else if (flag === "--kind") {
      if (value !== "service" && value !== "form") throw new Error("--kind must be service or form.");
      options.kind = value;
    } else if (flag === "--batch-size") options.batchSize = Number(value);
    else if (flag === "--out") options.out = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.population) throw new Error("--population <export.json> is required.");
  if (!options.out) throw new Error("--out <reconciliation.json> is required.");
  if (!Number.isInteger(options.batchSize) || options.batchSize! < 1 || options.batchSize! > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500.");
  }
  return options as Options;
}

/** The published record for each logical id, from the operator export. Never from a candidate. */
function publishedRecords(populationPath: string): Map<string, SiteContentRecord> {
  const population = JSON.parse(readFileSync(resolve(populationPath), "utf8")) as {
    version?: string;
    existingReleaseRecords?: Array<Record<string, unknown>>;
  };
  if (population.version !== "site-content-population-export-v1") {
    throw new Error(
      "Population export has the wrong version; regenerate it with scripts/sql/operator-export-site-content-population.sql.",
    );
  }
  // The export carries fingerprints, not the record body. The reader's own projection is what the
  // public site serves, so the snapshot fields come from there; see main().
  const byLogicalId = new Map<string, SiteContentRecord>();
  for (const row of population.existingReleaseRecords ?? []) {
    byLogicalId.set(String(row.logicalId), row as unknown as SiteContentRecord);
  }
  return byLogicalId;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const published = publishedRecords(options.population);

  const [{ requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();
  const supabase = createAdminClient();

  // Owner rows are the one thing service_role may read; everything published comes from the export.
  const { data: registryRows, error } = await supabase
    .from("clinical_registry_records")
    .select("*")
    .eq("kind", options.kind);
  if (error) throw new Error(`Could not read clinical_registry_records: ${error.message}`);
  const rows = (registryRows ?? []) as RegistryRecordRow[];

  const rowById = new Map(rows.map((row) => [String((row as unknown as { id: string }).id), row]));
  const entries = clinicalRegistryRowsToCorpusEntries(rows);
  const candidates: RegistryReconciliationCandidate[] = entries.map((entry) => ({
    entry,
    logicalId: dynamicLogicalId(entry),
    rowOwnerId: entry.ownerId,
    publicRecordId: entry.recordId,
    publicationState: "draft",
    renderedByPublicSite: false,
    explicitlyReconciled: false,
  }));

  // Trusted snapshots: one per logical group, from the PUBLISHED side, keyed by logicalId as the
  // plan validator requires (publicRecordId === logicalId).
  const groups = [...new Set(candidates.map((candidate) => candidate.logicalId))].sort();
  const missing = groups.filter((logicalId) => !published.has(logicalId));
  const report = buildRegistryReconciliationReport(candidates, []);
  const needsReview = report.groups.filter((g) => g.disposition === "divergent_requires_administrator_review");

  console.log(`Reconciliation plan — kind=${options.kind}`);
  console.log(`  owner rows            ${rows.length}`);
  console.log(`  logical groups        ${groups.length}`);
  console.log(`  published groups      ${published.size}`);
  console.log(`  groups not published  ${missing.length}`);
  console.log(`  needs owner review    ${needsReview.length}`);

  // THE REFUSAL. Everything below would be mechanical; this is the part that is not.
  if (needsReview.length > 0 || missing.length > 0) {
    console.error("");
    console.error("PLAN NOT WRITTEN — decisions are required that this script must not make.");
    if (needsReview.length > 0) {
      console.error(`  ${needsReview.length} group(s) diverge from the published snapshot. Which text becomes public`);
      console.error("  is a clinical judgement, and the database cannot catch a plausible wrong answer:");
      for (const group of needsReview.slice(0, 20)) console.error(`    ${group.logicalId}`);
      if (needsReview.length > 20) console.error(`    … and ${needsReview.length - 20} more`);
    }
    if (missing.length > 0) {
      console.error(`  ${missing.length} group(s) have an owner row but nothing published, so there is no trusted`);
      console.error("  snapshot to validate them against. They are new publications, not adoptions:");
      for (const logicalId of missing.slice(0, 20)) console.error(`    ${logicalId}`);
      if (missing.length > 20) console.error(`    … and ${missing.length - 20} more`);
    }
    console.error("");
    console.error("Run scripts/report-site-content-reconciliation.ts for the field-level breakdown of what");
    console.error(
      "moved, then decide the policy before a plan is built. See docs/site-content-publication-handover.md.",
    );
    process.exitCode = 1;
    return;
  }

  // Mechanical from here: exactly one `adopt` per group, `identical_duplicate` for siblings that
  // provably equal it, and never a `retire`.
  const dispositions = candidates
    .map((candidate) => {
      const snapshot = published.get(candidate.logicalId)!;
      const row = rowById.get(candidate.entry.recordId);
      const updatedAt = (row as unknown as { updated_at?: string } | undefined)?.updated_at;
      if (!updatedAt) throw new Error(`No updated_at for ${candidate.logicalId}; sourceVersion cannot be derived.`);
      const group = candidates.filter((other) => other.logicalId === candidate.logicalId);
      const isCanonical = group[0]!.entry.recordId === candidate.entry.recordId;
      return {
        contentHash: String((snapshot as unknown as Record<string, unknown>).contentHash),
        disposition: isCanonical ? "adopt" : "identical_duplicate",
        logicalId: candidate.logicalId,
        publicationVersion: String((snapshot as unknown as Record<string, unknown>).publicationFingerprint),
        sourceKind: options.kind,
        sourceRowId: candidate.entry.recordId,
        sourceVersion: new Date(updatedAt).toISOString(),
        trustedGovernanceHash: String((snapshot as unknown as Record<string, unknown>).governanceFingerprint),
        trustedPublicRecordId: candidate.logicalId,
        trustedRoute: `/${options.kind}s/${candidate.entry.slug}`,
      };
    })
    .sort((left, right) =>
      `${left.logicalId} ${left.sourceKind} ${left.sourceRowId}`.localeCompare(
        `${right.logicalId} ${right.sourceKind} ${right.sourceRowId}`,
      ),
    );

  const trustedSnapshots = groups.map((logicalId) => {
    const snapshot = published.get(logicalId)! as unknown as Record<string, unknown>;
    const slug = logicalId.split(":").slice(1).join(":");
    return {
      contentHash: String(snapshot.contentHash),
      governanceHash: String(snapshot.governanceFingerprint),
      logicalId,
      publicationVersion: String(snapshot.publicationFingerprint),
      publicRecordId: logicalId, // the validator requires these to be equal
      route: `/${options.kind}s/${slug}`,
    };
  });

  const counts = {
    adopt: dispositions.filter((item) => item.disposition === "adopt").length,
    retire: 0,
    identicalDuplicate: dispositions.filter((item) => item.disposition === "identical_duplicate").length,
    total: dispositions.length,
  };

  const withoutPlanDigest = {
    version: "site-content-reconciliation-plan-v1" as const,
    trustedSnapshotDigest: reconciliationHash({
      version: "site-content-trusted-snapshot-v1",
      records: trustedSnapshots,
    }),
    expectedRecordCount: dispositions.length,
    expectedGroupCount: trustedSnapshots.length,
    batchSize: options.batchSize,
    batchCount: Math.ceil(dispositions.length / options.batchSize),
    counts,
    trustedSnapshots,
    dispositions,
  };
  const plan = { ...withoutPlanDigest, planDigest: reconciliationHash(withoutPlanDigest) };

  // Validate with the production validator before writing, so a rejected plan never reaches an
  // owner's approved window. Imported statically: TypeScript refuses to call an assertion function
  // through a name it cannot type, which a dynamic import does not give (TS2775).
  assertSiteContentReconciliationInput(plan);

  writeFileSync(resolve(options.out), `${JSON.stringify(plan, null, 2)}\n`);
  console.log("");
  console.log(`  Wrote ${options.out}`);
  console.log(`  planDigest            ${plan.planDigest}`);
  console.log(`  trustedSnapshotDigest ${plan.trustedSnapshotDigest}`);
  console.log(`  adopt ${counts.adopt} | identical_duplicate ${counts.identicalDuplicate} | retire ${counts.retire}`);
  console.log("");
  console.log("  Validated against assertSiteContentReconciliationInput. The database recomputes both");
  console.log("  digests and will reject a plan that does not match its own fields.");
}

main().catch((error: unknown) => {
  console.error(`build-site-content-reconciliation-plan: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
