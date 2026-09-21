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
import { registryCorpusDetailHref } from "@/lib/registry-corpus-links";
import {
  buildRegistryReconciliationReport,
  canonicalCandidate,
  type CanonicalPublicRegistrySnapshot,
  type RegistryReconciliationCandidate,
} from "@/lib/site-content/adapters/registry";
import {
  assertSiteContentReconciliationInput,
  reconciliationHash,
} from "@/lib/site-content/site-content-reconciliation";
import type { ExistingSiteContentReleaseRecord } from "@/lib/site-content/site-content-sync";

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

/** Published fingerprints per logical id, from the operator export. Never from a candidate. */
function publishedRecords(populationPath: string): Map<string, ExistingSiteContentReleaseRecord> {
  const population = JSON.parse(readFileSync(resolve(populationPath), "utf8")) as {
    version?: string;
    existingReleaseRecords?: ExistingSiteContentReleaseRecord[];
  };
  if (population.version !== "site-content-population-export-v1") {
    throw new Error(
      "Population export has the wrong version; regenerate it with scripts/sql/operator-export-site-content-population.sql.",
    );
  }
  // Fingerprint-shaped only (ExistingSiteContentReleaseRecord). The triage snapshot type is the
  // same shape; do not cast these into SiteContentRecord.
  const byLogicalId = new Map<string, ExistingSiteContentReleaseRecord>();
  for (const row of population.existingReleaseRecords ?? []) {
    byLogicalId.set(row.logicalId, row);
  }
  return byLogicalId;
}

/**
 * Trusted snapshots for `buildRegistryReconciliationReport` — population fingerprints plus the
 * adapter canonical's publicRecordId / route. Distinct from the plan's trustedSnapshots, which
 * require publicRecordId === logicalId (see file header).
 */
function triageTrustedSnapshots(
  candidates: readonly RegistryReconciliationCandidate[],
  published: Map<string, ExistingSiteContentReleaseRecord>,
): CanonicalPublicRegistrySnapshot[] {
  const byLogicalId = new Map<string, RegistryReconciliationCandidate[]>();
  for (const candidate of candidates) {
    const group = byLogicalId.get(candidate.logicalId) ?? [];
    group.push(candidate);
    byLogicalId.set(candidate.logicalId, group);
  }
  const snapshots: CanonicalPublicRegistrySnapshot[] = [];
  for (const [logicalId, group] of [...byLogicalId.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const row = published.get(logicalId);
    if (!row) continue;
    const canonical = canonicalCandidate(group);
    if (!canonical) continue;
    const route = registryCorpusDetailHref({
      kind: canonical.entry.kind,
      slug: canonical.entry.slug,
      subkind: canonical.entry.subkind,
      recordId: canonical.entry.recordId,
    });
    if (!route) {
      throw new Error(`Canonical candidate for ${logicalId} has no public route.`);
    }
    snapshots.push({
      version: "clinical-kb-site-canonical-public-snapshot-v1",
      publicRecordId: canonical.publicRecordId ?? canonical.entry.recordId,
      logicalId,
      route,
      contentHash: row.contentHash,
      governanceHash: row.governanceFingerprint,
      publicationVersion: row.publicationFingerprint,
    });
  }
  return snapshots;
}

/**
 * What the counts mean, as a value rather than as a sequence of `console.error` calls.
 *
 * WHY THIS IS SEPARATE. `triageSnapshots` is empty exactly when no group has an adapter canonical
 * candidate, and `canonicalCandidate` requires ALL FOUR of `publicationState === "published"`,
 * `renderedByPublicSite`, `explicitlyReconciled` and `rowOwnerId === null`. This script supplies
 * the first three at their pre-adoption values by construction, and every
 * `clinical_registry_records` row is owner-scoped, so a corpus that has never published through
 * the control plane can produce NO snapshots at all. Every group then lands on
 * `divergent_requires_administrator_review`, and a refusal that reads those counts naively tells
 * the operator that N groups diverge from a published snapshot — about content nobody has touched,
 * against a snapshot that was never built.
 *
 * Measured live 2026-09-21: 222 service rows and 54 form rows, all with a non-null `owner_id`;
 * `site_content_publications` 0 rows; `site_content_public_records` 0 rows; the run reported
 * "triage snapshots 0 / needs owner review 222 / adoptable 0" and blamed the corpus.
 *
 * `not_comparable` is therefore its own verdict. It is still a refusal — nothing is published in
 * this state either — but it sends the reader at the mechanism rather than at 222 service records.
 */
export type PlannerVerdict =
  | { kind: "not_comparable"; comparableGroups: number; ownerScopedRows: number }
  | { kind: "needs_review"; needsReview: number; missing: number }
  | { kind: "proceed" };

export function plannerVerdict(input: {
  groups: number;
  missing: number;
  triageSnapshots: number;
  needsReview: number;
  ownerScopedRows: number;
}): PlannerVerdict {
  const comparableGroups = input.groups - input.missing;
  if (input.triageSnapshots === 0 && comparableGroups > 0) {
    return { kind: "not_comparable", comparableGroups, ownerScopedRows: input.ownerScopedRows };
  }
  if (input.needsReview > 0 || input.missing > 0) {
    return { kind: "needs_review", needsReview: input.needsReview, missing: input.missing };
  }
  return { kind: "proceed" };
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

  const groups = [...new Set(candidates.map((candidate) => candidate.logicalId))].sort();
  const missing = groups.filter((logicalId) => !published.has(logicalId));
  // Triage with real trusted snapshots from the population export — empty [] made every
  // single-candidate group look like needsReview and the mechanical write path unreachable.
  const triageSnapshots = triageTrustedSnapshots(candidates, published);
  const report = buildRegistryReconciliationReport(candidates, triageSnapshots);
  const needsReview = report.groups.filter((g) => g.disposition === "divergent_requires_administrator_review");

  console.log(`Reconciliation plan — kind=${options.kind}`);
  console.log(`  owner rows            ${rows.length}`);
  console.log(`  logical groups        ${groups.length}`);
  console.log(`  published groups      ${published.size}`);
  console.log(`  triage snapshots      ${triageSnapshots.length}`);
  console.log(`  groups not published  ${missing.length}`);
  console.log(`  needs owner review    ${needsReview.length}`);
  console.log(`  adoptable             ${report.adoptableCount}`);
  console.log(`  identical duplicates  ${report.identicalDuplicateCount}`);

  const verdict = plannerVerdict({
    groups: groups.length,
    missing: missing.length,
    triageSnapshots: triageSnapshots.length,
    needsReview: needsReview.length,
    ownerScopedRows: candidates.filter((candidate) => candidate.rowOwnerId !== null).length,
  });

  // THE REFUSAL THAT IS NOT ABOUT THE CORPUS. Reported first, because the counts underneath it
  // are the ones that mislead: every group reads as divergent when nothing was comparable.
  if (verdict.kind === "not_comparable") {
    console.error("");
    console.error("PLAN NOT WRITTEN — and this is NOT a finding about the catalogue's content.");
    console.error(`  ${verdict.comparableGroups} group(s) are published, yet not one trusted snapshot could be`);
    console.error("  built, so nothing was compared and every group reads as needing review. That count");
    console.error("  measures the state of the control plane, not drift in the records.");
    console.error("");
    console.error("  A group is only comparable when its adapter canonical candidate satisfies ALL of:");
    console.error("    publicationState = 'published'");
    console.error("    renderedByPublicSite = true");
    console.error("    explicitlyReconciled = true");
    console.error("    rowOwnerId = null");
    console.error(
      `  ${verdict.ownerScopedRows} of ${rows.length} row(s) here are owner-scoped, so the last one cannot hold,`,
    );
    console.error("  and a corpus that has never published through the control plane fails the first three");
    console.error("  by definition. No input to this script can change that.");
    console.error("");
    console.error("  So this is a FIRST PUBLICATION, not an adoption, and adoption is the only thing this");
    console.error("  script knows how to plan. Settle that before more tooling is written, and do NOT");
    console.error("  resolve it by loosening reconcileCanonicalPublicSiteContent — that would mark");
    console.error("  owner-scoped rows canonical for a clinical publication, which is the one judgement");
    console.error("  this script exists to refuse. See docs/site-content-publication-handover.md.");
    process.exitCode = 1;
    return;
  }

  // THE REFUSAL. Everything below would be mechanical; this is the part that is not.
  if (verdict.kind === "needs_review") {
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

  // Mechanical from here: exactly one `adopt` per group for the adapter's canonicalCandidate,
  // `identical_duplicate` for siblings in an adoptable / identical_duplicates group, never a `retire`.
  // Do not use group[0] — that is clinical_registryRowsToCorpusEntries order, not reconcileCanonicalPublicSiteContent.
  const candidatesByLogicalId = new Map<string, RegistryReconciliationCandidate[]>();
  for (const candidate of candidates) {
    const group = candidatesByLogicalId.get(candidate.logicalId) ?? [];
    group.push(candidate);
    candidatesByLogicalId.set(candidate.logicalId, group);
  }
  const canonicalByLogicalId = new Map<string, RegistryReconciliationCandidate>();
  for (const [logicalId, group] of candidatesByLogicalId) {
    const canonical = canonicalCandidate(group);
    if (!canonical) {
      throw new Error(`No adapter canonical candidate for adoptable group ${logicalId}.`);
    }
    canonicalByLogicalId.set(logicalId, canonical);
  }

  const dispositions = candidates
    .map((candidate) => {
      const snapshot = published.get(candidate.logicalId)!;
      const row = rowById.get(candidate.entry.recordId);
      const updatedAt = (row as unknown as { updated_at?: string } | undefined)?.updated_at;
      if (!updatedAt) throw new Error(`No updated_at for ${candidate.logicalId}; sourceVersion cannot be derived.`);
      const canonical = canonicalByLogicalId.get(candidate.logicalId)!;
      const isCanonical = canonical.entry.recordId === candidate.entry.recordId;
      const route =
        registryCorpusDetailHref({
          kind: candidate.entry.kind,
          slug: candidate.entry.slug,
          subkind: candidate.entry.subkind,
          recordId: candidate.entry.recordId,
        }) ?? `/${options.kind}s/${candidate.entry.slug}`;
      return {
        contentHash: snapshot.contentHash,
        disposition: isCanonical ? ("adopt" as const) : ("identical_duplicate" as const),
        logicalId: candidate.logicalId,
        publicationVersion: snapshot.publicationFingerprint,
        sourceKind: options.kind,
        sourceRowId: candidate.entry.recordId,
        sourceVersion: new Date(updatedAt).toISOString(),
        trustedGovernanceHash: snapshot.governanceFingerprint,
        trustedPublicRecordId: candidate.logicalId,
        trustedRoute: route,
      };
    })
    .sort(
      (left, right) =>
        left.logicalId.localeCompare(right.logicalId) ||
        left.sourceKind.localeCompare(right.sourceKind) ||
        left.sourceRowId.localeCompare(right.sourceRowId),
    );

  // Plan trustedSnapshots use publicRecordId === logicalId (validator convention).
  const trustedSnapshots = groups.map((logicalId) => {
    const snapshot = published.get(logicalId)!;
    const canonical = canonicalByLogicalId.get(logicalId)!;
    const route =
      registryCorpusDetailHref({
        kind: canonical.entry.kind,
        slug: canonical.entry.slug,
        subkind: canonical.entry.subkind,
        recordId: canonical.entry.recordId,
      }) ?? `/${options.kind}s/${canonical.entry.slug}`;
    return {
      contentHash: snapshot.contentHash,
      governanceHash: snapshot.governanceFingerprint,
      logicalId,
      publicationVersion: snapshot.publicationFingerprint,
      publicRecordId: logicalId, // the validator requires these to be equal
      route,
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
