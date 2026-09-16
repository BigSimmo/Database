/**
 * Refresh the frozen P03 epoch-zero bootstrap baked into
 * `supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql`
 * and its mirror in `supabase/schema.sql`.
 *
 * Why this exists
 * ---------------
 * Both files embed two dollar-quoted JSON blobs: the complete dynamic seed
 * population (`site_content_bootstrap_records`) and the registry baselines
 * (`site_content_registry_baselines`). Two committed tests assert that those
 * blobs equal the catalogue currently in the repository, so adding a single
 * service record makes both fail by construction. Until now there was no
 * committed generator, so the only recorded refresh was a hand edit.
 *
 * Everything this script emits is derived, and every derivation is proved
 * against the committed blob before anything is written: the run fails unless
 * all pre-existing entries reproduce byte-for-byte. Derivations, each confirmed
 * against all 843 entries of the 2026-08-24 freeze:
 *
 *   logicalDocumentId / logicalChunkId  deterministicUuid of the seeded label,
 *                                       matching scripts/sync-site-content-corpus.ts
 *   normalizedText                      canonicalSiteContentText(record.body)
 *   contentHash                         record.contentHash
 *   publicationFingerprint              record.publicationVersion
 *   governance/lineage/publicMetadata   siteContentValueHash over the same
 *                                       fields sync-site-content-corpus.ts uses
 *
 * The release digest and the content-addressed release id are recomputed from
 * the new population. The migration self-checks both on replay, so a mistake
 * fails CI's migration replay loudly rather than landing silently.
 *
 * Usage:
 *   npm run bootstrap:refresh -- --check   report drift only, write nothing
 *   npm run bootstrap:refresh -- --write   rewrite both SQL files
 *
 * `--write` edits an applied migration. Merging it reaches the live clinical
 * database, so it belongs in an approved window under the Supabase project
 * safety rules in AGENTS.md. Run `npm run check:drift` afterwards.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { diagnosisToRow, presentationToRow, type DifferentialRecordRow } from "@/lib/differential-records";
import { formRecords } from "@/lib/forms";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { recordToRow as medicationToRow, type MedicationRecordRow } from "@/lib/medication-records";
import { recordToRow as registryToRow, type RegistryRecordRow } from "@/lib/registry-records";
import { serviceRecords } from "@/lib/services";
import { canonicalSiteContentText, siteContentValueHash } from "@/lib/site-content/site-content-manifest";
import { canonicalDynamicSiteContentProjection } from "@/lib/site-content/site-content-publication";

const MIGRATION = "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql";
const SCHEMA = "supabase/schema.sql";
const GENERATION_ID = "bootstrap-v1";
const HEALTH_MODULE = "src/lib/site-content/site-content-health.ts";

/** The audit columns the freeze was generated with. They are part of the
 *  projection input, so they are pinned rather than taken from the clock. */
const OWNER_ID = "00000000-0000-4000-8000-000000000000";
const AUDIT = {
  id: OWNER_ID,
  owner_id: OWNER_ID,
  created_at: "2026-08-24T00:00:00.000Z",
  updated_at: "2026-08-24T00:00:00.000Z",
  last_reviewed_at: null,
  review_due_at: null,
} as const;

type BootstrapEntry = {
  logicalId: string;
  logicalDocumentId: string;
  logicalChunkId: string;
  normalizedText: string;
  contentHash: string;
  publicationFingerprint: string;
  governanceFingerprint: string;
  lineageFingerprint: string;
  publicMetadataFingerprint: string;
  record: Record<string, unknown>;
  renderPayload: Record<string, unknown>;
};

function deterministicUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** `site_content_canonical_json` in SQL: object keys sorted, no insignificant
 *  whitespace. JSON.stringify with sorted keys reproduces it for these values,
 *  which carry no numbers needing IEEE-754 normalization. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

function jsonSha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function releaseId(releaseDigest: string, targetChangeEpoch: number, generationId: string) {
  const hash = jsonSha256({
    version: "site-content-release-instance-v1",
    releaseDigest,
    targetChangeEpoch: String(targetChangeEpoch),
    generationId,
  });
  const value = `${hash.slice(0, 12)}5${hash.slice(13, 16)}8${hash.slice(17, 32)}`;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function bootstrapDigest(entries: readonly BootstrapEntry[]) {
  const records = entries
    .map(({ logicalId, record, renderPayload }) => ({ logicalId, record, renderPayload }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.logicalId), Buffer.from(right.logicalId)));
  return jsonSha256({ version: "site-content-bootstrap-public-release-v1", records });
}

/**
 * Every field of a bootstrap entry that is DERIVED from its record. Kept as one
 * function so the same code produces a new entry and re-checks a frozen one, which
 * is what lets `assertFaithful` tell a broken derivation from an intended edit.
 */
function bootstrapEntry(
  record: Record<string, unknown> & { logicalId: string },
  renderPayload: Record<string, unknown>,
): BootstrapEntry {
  const field = (key: string) => record[key] as never;
  return {
    logicalId: record.logicalId,
    logicalDocumentId: deterministicUuid(`site-content-document:${record.logicalId}`),
    logicalChunkId: deterministicUuid(`site-content-chunk:${record.logicalId}`),
    normalizedText: canonicalSiteContentText(record.body as string),
    contentHash: field("contentHash"),
    publicationFingerprint: field("publicationVersion"),
    governanceFingerprint: siteContentValueHash({
      access: record.access,
      validationStatus: record.validationStatus,
      sourceStatus: record.sourceStatus,
    }),
    lineageFingerprint: siteContentValueHash(record.sourceLineage),
    publicMetadataFingerprint: siteContentValueHash({
      route: record.route,
      title: record.title,
      sourceRole: record.sourceRole,
    }),
    record,
    renderPayload,
  };
}

function currentEntries(): BootstrapEntry[] {
  const snapshot = loadDifferentialSnapshot();
  const projections = [
    ...serviceRecords.map((record) =>
      canonicalDynamicSiteContentProjection("service", {
        ...registryToRow(record, OWNER_ID, "service"),
        ...AUDIT,
      } as RegistryRecordRow),
    ),
    ...formRecords.map((record) =>
      canonicalDynamicSiteContentProjection("form", {
        ...registryToRow(record, OWNER_ID, "form"),
        ...AUDIT,
      } as RegistryRecordRow),
    ),
    ...loadMedicationSnapshot().map((record) =>
      canonicalDynamicSiteContentProjection("medication", {
        ...medicationToRow(record, OWNER_ID),
        ...AUDIT,
      } as MedicationRecordRow),
    ),
    ...snapshot.diagnoses.map((record) =>
      canonicalDynamicSiteContentProjection("differential", {
        ...diagnosisToRow(record, OWNER_ID, snapshot),
        ...AUDIT,
      } as DifferentialRecordRow),
    ),
    ...snapshot.presentations.map((record) =>
      canonicalDynamicSiteContentProjection("presentation", {
        ...presentationToRow(record, OWNER_ID, snapshot),
        ...AUDIT,
      } as DifferentialRecordRow),
    ),
  ];

  return projections
    .map(({ record, renderPayload }) => bootstrapEntry(record, renderPayload))
    .sort((left, right) => (left.logicalId < right.logicalId ? -1 : left.logicalId > right.logicalId ? 1 : 0));
}

function currentBaselines() {
  return Object.fromEntries([
    ...serviceRecords.map((record) => [`service:${record.slug}`, record] as const),
    ...formRecords.map((record) => [`form:${record.slug}`, record] as const),
  ]);
}

function block(source: string, tag: string) {
  const pattern = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`${tag} block not found`);
  return match[1]!;
}

function replaceBlock(source: string, tag: string, payload: string) {
  const open = source.indexOf(`$${tag}$`);
  const close = source.indexOf(`$${tag}$`, open + tag.length + 2);
  if (open < 0 || close < 0) throw new Error(`${tag} block not found`);
  return source.slice(0, open + tag.length + 2) + payload + source.slice(close);
}

/** Refuse to write unless every pre-existing entry reproduces byte-for-byte.
 *  A single drift means a derivation above no longer matches the freeze, and
 *  rewriting on that basis would corrupt records this change never intended
 *  to touch. */
function assertFaithful(entries: readonly BootstrapEntry[], baselines: Record<string, unknown>, migration: string) {
  const frozenEntries = JSON.parse(block(migration, "site_content_bootstrap_records")) as BootstrapEntry[];
  const frozenBaselines = JSON.parse(block(migration, "site_content_registry_baselines")) as Record<string, unknown>;
  const byId = new Map(frozenEntries.map((entry) => [entry.logicalId, entry]));

  // A derivation error and an intended content edit both change an entry, but only one
  // of them is a fault. Re-derive each FROZEN entry from its own frozen record: that
  // exercises every formula in this script against data it must already reproduce, and
  // is unaffected by the catalogue moving underneath it. Any mismatch means a formula
  // has drifted from the freeze, and rewriting on that basis would corrupt records this
  // change never intended to touch.
  const derivationDrift = frozenEntries
    .filter((frozen) => {
      const rederived = bootstrapEntry(frozen.record as never, frozen.renderPayload);
      return (
        [
          "logicalDocumentId",
          "logicalChunkId",
          "normalizedText",
          "contentHash",
          "publicationFingerprint",
          "governanceFingerprint",
          "lineageFingerprint",
          "publicMetadataFingerprint",
        ] as const
      ).some((key) => rederived[key] !== frozen[key]);
    })
    .map((frozen) => frozen.logicalId);

  // Content that genuinely changed. Expected whenever a canonical record supersedes a
  // legacy one, so these are reported for review rather than treated as faults.
  const updatedEntries = entries
    .filter((entry) => byId.has(entry.logicalId))
    .filter((entry) => JSON.stringify(byId.get(entry.logicalId)) !== JSON.stringify(entry))
    .map((entry) => entry.logicalId);
  const updatedBaselines = Object.entries(frozenBaselines)
    .filter(([key, value]) => JSON.stringify(baselines[key]) !== JSON.stringify(value))
    .map(([key]) => key);

  const frozenDigest = bootstrapDigest(frozenEntries);
  const addedEntries = entries.filter((entry) => !byId.has(entry.logicalId)).map((entry) => entry.logicalId);
  const addedBaselines = Object.keys(baselines).filter((key) => !(key in frozenBaselines));
  const removed = frozenEntries.filter((frozen) => !entries.some((entry) => entry.logicalId === frozen.logicalId));

  console.log(
    `frozen population   : ${frozenEntries.length} records, ${Object.keys(frozenBaselines).length} baselines`,
  );
  console.log(`current population  : ${entries.length} records, ${Object.keys(baselines).length} baselines`);
  console.log(
    `derivations re-check: ${frozenEntries.length - derivationDrift.length}/${frozenEntries.length} frozen entries re-derive exactly`,
  );
  for (const id of derivationDrift.slice(0, 20)) console.log(`   DERIVATION DRIFT ${id}`);
  for (const id of [...updatedEntries, ...updatedBaselines]) console.log(`   update ${id}`);
  for (const id of [...addedEntries, ...addedBaselines]) console.log(`   add    ${id}`);
  for (const entry of removed) console.log(`   REMOVE ${entry.logicalId}`);

  if (derivationDrift.length) {
    throw new Error(
      `${derivationDrift.length} frozen entries no longer re-derive from their own records. ` +
        "A formula in this script has diverged from the freeze; fix that before writing.",
    );
  }
  // Epoch zero is the complete seed population, so losing a record silently would leave
  // a rollback serving less than the catalogue holds.
  if (removed.length) {
    throw new Error(
      `${removed.length} records present in the freeze are missing from the catalogue. ` +
        "Removing a record from epoch zero needs a deliberate decision, not a refresh.",
    );
  }
  return { frozenEntries, frozenDigest };
}

function main() {
  const write = process.argv.includes("--write");
  const entries = currentEntries();
  const baselines = currentBaselines();
  const migration = readFileSync(MIGRATION, "utf8");
  const { frozenEntries, frozenDigest } = assertFaithful(entries, baselines, migration);

  const oldDigest = bootstrapDigest(frozenEntries);
  const newDigest = bootstrapDigest(entries);
  const oldId = releaseId(oldDigest, 0, GENERATION_ID);
  const newId = releaseId(newDigest, 0, GENERATION_ID);

  console.log(`release digest      : ${oldDigest} -> ${newDigest}`);
  console.log(`release id          : ${oldId} -> ${newId}`);
  if (!migration.includes(oldDigest)) throw new Error("The recomputed frozen digest is not present in the migration.");
  if (!migration.includes(oldId)) throw new Error("The recomputed frozen release id is not present in the migration.");
  if (frozenDigest !== oldDigest) throw new Error("Digest derivation is unstable.");

  // `site-content-health.ts` decides whether the running site is on its retained
  // bootstrap by matching the active release against a fixed set of ids. The id moves
  // with the population, so a refresh that forgets to add the new one ships code that
  // cannot recognise its own bootstrap. Refuse to write until it is listed.
  const health = readFileSync(HEALTH_MODULE, "utf8");
  if (!health.includes(newId)) {
    throw new Error(
      `${HEALTH_MODULE} does not list the refreshed bootstrap release id.\n` +
        `Add this line to RETAINED_BOOTSTRAP_RELEASE_IDS, keeping the existing ids:\n` +
        `  "${newId}",\n` +
        "Never remove an id a live database may still hold.",
    );
  }

  if (entries.length === frozenEntries.length && newDigest === oldDigest) {
    console.log("Nothing to refresh: the frozen bootstrap already matches the catalogue.");
    return;
  }
  if (!write) {
    console.log("\nCheck only. Re-run with --write to rewrite both SQL files.");
    console.log("Writing edits an applied migration: merge only inside an approved window.");
    return;
  }

  const boot = JSON.stringify(entries);
  const base = JSON.stringify(baselines);
  for (const path of [MIGRATION, SCHEMA]) {
    let source = readFileSync(path, "utf8");
    source = replaceBlock(source, "site_content_bootstrap_records", boot);
    source = replaceBlock(source, "site_content_registry_baselines", base);
    source = source.split(oldDigest).join(newDigest).split(oldId).join(newId);
    source = source
      .split(`, ${frozenEntries.length}, ${frozenEntries.length},`)
      .join(`, ${entries.length}, ${entries.length},`)
      .split(`<> ${frozenEntries.length}`)
      .join(`<> ${entries.length}`);
    writeFileSync(path, source);
    console.log(`rewrote ${path}`);
  }
  console.log("\nStill to do by hand: the release id is pinned in test files; update those, then");
  console.log("regenerate supabase/drift-manifest.json and run npm run check:drift.");
}

try {
  main();
} catch (error) {
  // A guard refusal is an expected outcome of this script, not a crash. Print the
  // remediation it carries rather than a stack trace nobody reads.
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
