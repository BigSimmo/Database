/**
 * Read-only: how many catalogue records would actually need the owner's judgement to publish.
 *
 * WHY THIS EXISTS. Publishing the catalogue for the first time runs the pipeline in "initial
 * adoption" mode, which needs one disposition per locked source row. The raw row count makes that
 * sound like a review of every record. It is not: `buildRegistryReconciliationReport` triages each
 * logical group into `adoptable`, `identical_duplicates`, or
 * `divergent_requires_administrator_review`, and only the third needs a human. This reports those
 * three numbers, and lists the groups in the third, so the size of the review is known before any
 * publication tooling is built around a guess.
 *
 * WHAT IT COMPARES. For every logical group it builds two things and asks whether they agree:
 *
 *   - the CANDIDATE, projected from the live owner-scoped registry row
 *     (`clinical_registry_records` -> `clinicalRegistryRowsToCorpusEntries`), and
 *   - the TRUSTED SNAPSHOT, built from what the public release actually serves today
 *     (`site_content_release_records` for the active release).
 *
 * Both go through `expectedCanonicalPublicRegistrySnapshot`, the same function adoption itself
 * uses, rather than a reimplementation of its hashing. A group whose candidate reproduces the
 * published snapshot is adoptable without a decision; a group that diverges is one the owner has
 * to look at. That is the whole measurement.
 *
 * WHY IT REFUSES RATHER THAN GUESSES. With no trusted snapshots at all, the classifier cannot mark
 * anything `adoptable` -- every group falls through to "requires administrator review" and the
 * report would print a large, frightening and meaningless number. The epoch-zero release predates
 * the adoption pipeline and does not record a `publicRecordId`, so the baseline here is
 * reconstructed rather than looked up, and a single field computed differently would silently
 * produce that same worthless answer. So this exits non-zero and says so when it cannot establish
 * a baseline (see BASELINE SANITY below) instead of reporting a number nobody should act on.
 *
 * WHAT IT DOES NOT DO. It writes nothing, publishes nothing, and calls no provider. It does not
 * produce a reconciliation plan -- it sizes the review that producing one would require.
 *
 * USAGE
 *   node scripts/run-tsx.mjs scripts/report-site-content-reconciliation.ts [--kind service] [--out report.json]
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { clinicalRegistryRowsToCorpusEntries, type RegistryCorpusEntry } from "@/lib/registry-corpus";
import type { RegistryRecordRow } from "@/lib/registry-records";
import { dynamicLogicalId } from "@/lib/site-content/adapters";
import {
  buildRegistryReconciliationReport,
  expectedCanonicalPublicRegistrySnapshot,
  registryEntryToSiteContentRecord,
  type CanonicalPublicRegistrySnapshot,
  type RegistryReconciliationCandidate,
} from "@/lib/site-content/adapters/registry";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";

type Options = { kind: "service" | "form"; out?: string };

function parseOptions(argv: readonly string[]): Options {
  const options: Options = { kind: "service" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--kind") {
      const value = argv[(index += 1)];
      if (value !== "service" && value !== "form") throw new Error("--kind must be service or form.");
      options.kind = value;
      continue;
    }
    if (flag === "--out") {
      options.out = argv[(index += 1)];
      continue;
    }
    throw new Error(`Unknown argument: ${flag}`);
  }
  return options;
}

/**
 * The record a release row publishes. Stored as the canonical `SiteContentRecord` the reader
 * serves, so the baseline is what production actually renders rather than a re-derivation of it.
 */
function releaseRecord(row: { record: unknown }): SiteContentRecord {
  const record = row.record;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("A published row does not carry a record object.");
  }
  return record as SiteContentRecord;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [{ requireServerEnv }, { createAdminClient }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
  ]);
  requireServerEnv();
  const supabase = createAdminClient();

  // 1. What the public site serves today. Read through read_site_content_public_records -- the same
  //    RPC every public registry route uses -- rather than the control-plane tables, which are
  //    correctly closed to service_role. The baseline is therefore what production actually serves,
  //    not a re-derivation of it.
  const { data: publicRows, error: publicError } = await supabase.rpc("read_site_content_public_records", {
    p_kind: options.kind,
    p_slug: null,
  });
  if (publicError) throw new Error(`Could not read the public catalogue: ${publicError.message}`);
  const published = (publicRows ?? []) as Array<{
    record: SiteContentRecord;
    snapshot: { releaseId?: string | null; state?: string | null; changeEpoch?: string | null } | null;
    initialized: boolean;
  }>;
  if (published.length === 0) throw new Error("The public catalogue returned no rows; nothing to compare against.");
  const snapshot = published[0]!.snapshot;
  const activeReleaseId = snapshot?.releaseId ?? "(none)";
  const initialized = published[0]!.initialized;

  // 2. The owner-scoped rows a publication would adopt.
  const { data: registryRows, error: registryError } = await supabase
    .from("clinical_registry_records")
    .select("*")
    .eq("kind", options.kind);
  if (registryError) throw new Error(`Could not read clinical_registry_records: ${registryError.message}`);

  const entries = clinicalRegistryRowsToCorpusEntries((registryRows ?? []) as RegistryRecordRow[]);
  const candidates: RegistryReconciliationCandidate[] = entries.map((entry: RegistryCorpusEntry) => ({
    entry,
    logicalId: dynamicLogicalId(entry),
    rowOwnerId: entry.ownerId,
    publicRecordId: entry.recordId,
    // Conservative and stated: these are operator decisions the reconciliation step supplies, and
    // `clinical_registry_records` stores none of them. They select the canonical candidate WITHIN a
    // group; they do not affect whether a group's content diverges, which is what is counted here.
    publicationState: "draft",
    renderedByPublicSite: false,
    explicitlyReconciled: false,
  }));

  // 3. The baseline, built from the release with the production rule, keyed to the candidate's own
  //    identity -- the only field adoption takes from the candidate side.
  const publicRecordIdByLogicalId = new Map(candidates.map((c) => [c.logicalId, c.publicRecordId!]));
  const trustedSnapshots: CanonicalPublicRegistrySnapshot[] = [];
  let releaseGroupsWithoutCandidate = 0;
  for (const row of published) {
    const record = releaseRecord(row);
    const publicRecordId = publicRecordIdByLogicalId.get(record.logicalId);
    if (!publicRecordId) {
      releaseGroupsWithoutCandidate += 1;
      continue; // Published but no owner row to adopt it: reported, never invented.
    }
    trustedSnapshots.push(expectedCanonicalPublicRegistrySnapshot(publicRecordId, record));
  }

  const report = buildRegistryReconciliationReport(candidates, trustedSnapshots);
  const needsReview = report.groups.filter((g) => g.disposition === "divergent_requires_administrator_review");
  const candidatesWithoutRelease = report.groups.length - trustedSnapshots.length;

  // BASELINE SANITY, decided by structure rather than by the verdict. An earlier version treated
  // `adoptableCount === 0` as proof the comparison was broken. It is not: every record can legitimately
  // have drifted. What distinguishes a broken comparison from real drift is whether the STRUCTURAL
  // fields line up -- version, producerClass, domain, sourceRole, access, sourceLineage are identity,
  // not content, and if those disagree the two sides are not being built the same way and nothing
  // below means anything. That check runs in the diagnosis block and sets this.
  let baselineEstablished = report.adoptableCount > 0;

  console.log(`Reconciliation review size — kind=${options.kind}, release ${activeReleaseId}`);
  console.log(`  initialized=${initialized}  snapshotState=${snapshot?.state ?? "(none)"}  changeEpoch=${snapshot?.changeEpoch ?? "(none)"}`);
  console.log("");
  console.log(`  owner rows (candidates)          ${candidates.length}`);
  console.log(`  logical groups                   ${report.groups.length}`);
  console.log(`  published groups                 ${published.length}`);
  console.log(`  published groups matched         ${trustedSnapshots.length}`);
  console.log(`  published, no owner row          ${releaseGroupsWithoutCandidate}`);
  console.log(`  owner row, not yet published     ${candidatesWithoutRelease}`);
  console.log("");
  console.log(`  adoptable (no decision needed)   ${report.adoptableCount}`);
  console.log(`  identical duplicates             ${report.identicalDuplicateCount}`);
  console.log(`  NEEDS OWNER REVIEW               ${report.administratorReviewCount}`);

  // Field-level diagnosis. "0 adoptable" has two very different causes -- the comparison is wrong,
  // or every record really has drifted since the freeze -- and the counts alone cannot tell them
  // apart. Show which FIELDS differ: a difference confined to contentHash/publicationVersion is
  // real content drift; a difference in version/producerClass/route/governanceHash means the two
  // sides are not being built the same way and the counts mean nothing.
  if (!baselineEstablished || process.argv.includes("--diagnose")) {
    const publishedByLogicalId = new Map(published.map((row) => [releaseRecord(row).logicalId, releaseRecord(row)]));
    const fieldDiffs = new Map<string, number>();
    let compared = 0;
    for (const candidate of candidates) {
      const publishedRecord = publishedByLogicalId.get(candidate.logicalId);
      if (!publishedRecord) continue;
      const mine = expectedCanonicalPublicRegistrySnapshot(candidate.publicRecordId!, publishedRecord);
      const theirs = expectedCanonicalPublicRegistrySnapshot(
        candidate.publicRecordId!,
        // Project it the way adoption does. An earlier version of this line passed the raw
        // RegistryCorpusEntry through a cast; a corpus entry has no logicalId, so every field
        // "differed" and the diagnosis was worthless. Never cast into this comparison.
        registryEntryToSiteContentRecord(candidate.entry, {
          logicalId: candidate.logicalId,
          sourceLineage: candidate.sourceLineage,
        }),
      );
      compared += 1;
      for (const key of Object.keys(mine) as Array<keyof typeof mine>) {
        if (mine[key] !== theirs[key]) fieldDiffs.set(String(key), (fieldDiffs.get(String(key)) ?? 0) + 1);
      }
    }
    console.log("");
    console.log(`  Field-level diagnosis over ${compared} overlapping groups:`);
    for (const [field, count] of [...fieldDiffs.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${field.padEnd(20)} differs in ${count}/${compared}`);
    }
    if (fieldDiffs.size === 0) console.log("    (no field differs — the mismatch is elsewhere)");

    // governanceHash is a hash of eight record fields. Which of them actually moved decides whether
    // this is curation drift (validationStatus/sourceStatus) or a structural mismatch that would
    // make the whole comparison meaningless (version/producerClass/domain/sourceRole/access).
    const govKeys = [
      "version",
      "producerClass",
      "domain",
      "sourceRole",
      "access",
      "validationStatus",
      "sourceStatus",
      "sourceLineage",
    ] as const;
    const govDiffs = new Map<string, number>();
    let govCompared = 0;
    for (const candidate of candidates) {
      const publishedRecord = publishedByLogicalId.get(candidate.logicalId);
      if (!publishedRecord) continue;
      const projected = registryEntryToSiteContentRecord(candidate.entry, {
        logicalId: candidate.logicalId,
        sourceLineage: candidate.sourceLineage,
      });
      govCompared += 1;
      for (const key of govKeys) {
        const left = JSON.stringify((publishedRecord as Record<string, unknown>)[key] ?? null);
        const right = JSON.stringify((projected as Record<string, unknown>)[key] ?? null);
        if (left !== right) govDiffs.set(key, (govDiffs.get(key) ?? 0) + 1);
      }
    }
    const structuralKeys = ["version", "producerClass", "domain", "sourceRole", "access", "sourceLineage"];
    const structuralMismatch = structuralKeys.reduce((total, key) => total + (govDiffs.get(key) ?? 0), 0);
    if (govCompared > 0 && structuralMismatch === 0) baselineEstablished = true;
    console.log("");
    console.log(`  governanceHash inputs, over ${govCompared} groups:`);
    for (const key of govKeys) {
      const count = govDiffs.get(key) ?? 0;
      console.log(`    ${key.padEnd(20)} differs in ${count}/${govCompared}`);
    }
  }

  if (!baselineEstablished) {
    console.error("");
    console.error("BASELINE NOT ESTABLISHED: structural fields disagree between the published record and");
    console.error("the projected candidate, so the two sides are not being built the same way and the");
    console.error("counts above are an artefact rather than a measurement. Fix the projection before");
    console.error("believing any number here. (Content-only drift does NOT trigger this: it is judged on");
    console.error("version/producerClass/domain/sourceRole/access/sourceLineage, which are identity.)");
    process.exitCode = 1;
    return;
  }

  if (needsReview.length > 0) {
    console.log("");
    console.log("  Groups needing a decision:");
    for (const group of needsReview.slice(0, 40)) {
      console.log(`    ${group.logicalId}  (${group.candidateCount} candidate(s), ${group.normalizedContentHashes.length} distinct content hash(es))`);
    }
    if (needsReview.length > 40) console.log(`    … and ${needsReview.length - 40} more`);
  }

  if (options.out) {
    writeFileSync(resolve(options.out), `${JSON.stringify({ activeReleaseId, kind: options.kind, report }, null, 2)}\n`);
    console.log("");
    console.log(`  Wrote ${options.out}`);
  }
}

main().catch((error: unknown) => {
  console.error(`report-site-content-reconciliation: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
