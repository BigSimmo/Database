import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadDifferentialSnapshot } from "../src/lib/differential-fixtures";
import { diagnosisToRow, presentationToRow, type DifferentialRecordRow } from "../src/lib/differential-records";
import { formRecords } from "../src/lib/forms";
import { loadMedicationSnapshot } from "../src/lib/medication-snapshot";
import { recordToRow as medicationToRow, type MedicationRecordRow } from "../src/lib/medication-records";
import { recordToRow as registryToRow, type RegistryRecordRow } from "../src/lib/registry-records";
import { serviceRecords } from "../src/lib/services";
import { siteContentValueHash } from "../src/lib/site-content/site-content-manifest";
import { canonicalDynamicSiteContentProjection } from "../src/lib/site-content/site-content-publication";

/**
 * site-content:p03 — regenerates the two frozen P03 seed blobs.
 *
 * `supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql` and
 * `supabase/schema.sql` each embed the whole site-content seed population as dollar-quoted
 * JSON: `$site_content_registry_baselines$` (the per-record baseline
 * `site_content_registry_baseline(text,text)` reads for SQL-null and forced-field merging)
 * and `$site_content_bootstrap_records$` (the epoch-zero public-records seed).
 *
 * Both are pinned to the live runtime records by `tests/supabase-schema.test.ts` and
 * `tests/site-content-publication-route.test.ts`, so ANY edit to `data/forms-catalog.json`
 * or the services snapshot turns them red. Before this script existed there was no
 * supported way to refresh them: `canonicalDynamicSiteContentProjection` returns only
 * `record` and `renderPayload`, while the frozen entries also carry `logicalDocumentId`,
 * `logicalChunkId`, `normalizedText`, `contentHash` and three fingerprints. Those seven
 * fields are derived in `scripts/sync-site-content-corpus.ts`, which is a provider-writing
 * CLI and cannot be run to produce a file. The derivations are duplicated below, and
 * `tests/site-content-p03-baseline.test.ts` pins them against that script so the two
 * cannot drift apart.
 *
 * WHAT THIS DOES NOT DO. It rewrites an already-applied migration, which is this
 * repository's established convention for this file (see `fb0b0279b`, "refresh P03 form
 * PDF restriction baseline"). Applying the refreshed definition to the live database is a
 * separate, approved step: a merge does not re-run an existing migration. It also does not
 * refresh `supabase/drift-manifest.json`, whose `schema_sha256` and the `def_hash` of
 * `public.site_content_registry_baseline(text,text)` both move with `schema.sql`. Run
 * `npm run drift:manifest` (requires Docker) after this, or the offline half of
 * `check:drift` fails and says so.
 *
 * Flags:
 *   --check   exit 1 if either file is stale, writing nothing (for CI)
 */

const repoUrl = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const MIGRATION = "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql";
const SCHEMA = "supabase/schema.sql";
const TARGETS = [MIGRATION, SCHEMA] as const;

/**
 * The owner the epoch-zero seed was frozen under. It is a fixture identity, not a real
 * account, and it is load-bearing: it feeds the audit columns every projection hashes.
 */
const SEED_OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SEED_AUDIT = {
  id: SEED_OWNER_ID,
  owner_id: SEED_OWNER_ID,
  created_at: "2026-08-24T00:00:00.000Z",
  updated_at: "2026-08-24T00:00:00.000Z",
  last_reviewed_at: null,
  review_due_at: null,
} as const;

/** Mirrors `deterministicUuid` in scripts/sync-site-content-corpus.ts. */
export function deterministicUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

type Projection = ReturnType<typeof canonicalDynamicSiteContentProjection>;

/** Mirrors `sourceRecord` in scripts/sync-site-content-corpus.ts, plus the seed columns. */
export function bootstrapEntry(projection: Projection) {
  const record = projection.record;
  return {
    logicalId: record.logicalId,
    logicalDocumentId: deterministicUuid(`site-content-document:${record.logicalId}`),
    logicalChunkId: deterministicUuid(`site-content-chunk:${record.logicalId}`),
    normalizedText: record.body,
    contentHash: record.contentHash,
    publicationFingerprint: record.publicationVersion,
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
    renderPayload: projection.renderPayload,
  };
}

export function registryBaselines() {
  return Object.fromEntries([
    ...serviceRecords.map((record) => [`service:${record.slug}`, record] as const),
    ...formRecords.map((record) => [`form:${record.slug}`, record] as const),
  ]);
}

export function bootstrapRecords() {
  const snapshot = loadDifferentialSnapshot();
  return [
    ...serviceRecords.map((record) =>
      canonicalDynamicSiteContentProjection("service", {
        ...registryToRow(record, SEED_OWNER_ID, "service"),
        ...SEED_AUDIT,
      } as RegistryRecordRow),
    ),
    ...formRecords.map((record) =>
      canonicalDynamicSiteContentProjection("form", {
        ...registryToRow(record, SEED_OWNER_ID, "form"),
        ...SEED_AUDIT,
      } as RegistryRecordRow),
    ),
    ...loadMedicationSnapshot().map((record) =>
      canonicalDynamicSiteContentProjection("medication", {
        ...medicationToRow(record, SEED_OWNER_ID),
        ...SEED_AUDIT,
      } as MedicationRecordRow),
    ),
    ...snapshot.diagnoses.map((record) =>
      canonicalDynamicSiteContentProjection("differential", {
        ...diagnosisToRow(record, SEED_OWNER_ID, snapshot),
        ...SEED_AUDIT,
      } as DifferentialRecordRow),
    ),
    ...snapshot.presentations.map((record) =>
      canonicalDynamicSiteContentProjection("presentation", {
        ...presentationToRow(record, SEED_OWNER_ID, snapshot),
        ...SEED_AUDIT,
      } as DifferentialRecordRow),
    ),
  ]
    .map(bootstrapEntry)
    .sort((left, right) => left.logicalId.localeCompare(right.logicalId));
}

/**
 * `public.site_content_canonical_json` in JavaScript.
 *
 * The seed insert is followed by a guard that recomputes
 * `site_content_bootstrap_digest` over what actually landed in
 * `site_content_release_records` and aborts the replay on a mismatch. The digest is a
 * sha256 over this canonical rendering of `{logicalId, record, renderPayload}` for all 843
 * rows, ordered by `logical_id` under the C collation — so refreshing the blob without
 * refreshing the digest leaves a `schema.sql` that cannot be replayed at all.
 *
 * The SQL rules, mirrored exactly: null renders as `null`; an object renders its entries
 * sorted by key under C collation, which is byte order; an array keeps its order; a scalar
 * renders as jsonb's own text. `tests/site-content-p03-baseline.test.ts` pins this against
 * two digests taken from real container replays, on two different datasets, so a
 * divergence here fails offline rather than in a replay nobody runs.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // Byte order, not locale order: `collate "C"` compares the UTF-8 encoding.
      .sort(([left], [right]) => (Buffer.from(left, "utf8") < Buffer.from(right, "utf8") ? -1 : 1));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** `public.site_content_bootstrap_digest` for a generated bootstrap population. */
export function bootstrapDigest(entries: ReturnType<typeof bootstrapRecords>) {
  const records = [...entries]
    .sort((left, right) => (Buffer.from(left.logicalId, "utf8") < Buffer.from(right.logicalId, "utf8") ? -1 : 1))
    .map((entry) => ({
      logicalId: entry.logicalId,
      record: entry.record,
      renderPayload: entry.renderPayload,
    }));
  const canonical = canonicalJson({ version: "site-content-bootstrap-public-release-v1", records });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Reports whether the seeded bootstrap release still describes the blob.
 *
 * It deliberately does NOT repair a mismatch, because the repair is not local. The release
 * digest appears five times in the generated block, and the release's own UUID is derived
 * from it: `site_content_retained_bootstrap_valid` asserts
 * `r.id = site_content_release_id(r.release_digest, 0, 'bootstrap-v1')`. So moving the
 * digest re-keys the release identity, and that UUID is hardcoded 36 times across the
 * migration and schema.sql — including inside `create function` bodies already applied to
 * the live database — and another 12 times in application code. Rewriting the digest alone
 * trades one broken invariant for another; rewriting the identity is an owner decision
 * about the live clinical content control plane, in an approved window.
 *
 * So this returns the facts and the caller says them out loud.
 */
export function bootstrapReleaseState(sql: string, digest: string, count: number) {
  const begin = sql.indexOf("-- BEGIN GENERATED SITE CONTENT BOOTSTRAP RELEASE");
  const end = sql.indexOf("-- END GENERATED SITE CONTENT BOOTSTRAP RELEASE");
  if (begin < 0 || end < 0 || end < begin) throw new Error("Could not find the generated bootstrap-release block.");
  const block = sql.slice(begin, end);
  const pinnedDigest = block.match(
    /site_content_bootstrap_digest\('[0-9a-f-]+'\) is distinct from '([0-9a-f]{64})'/,
  )?.[1];
  const pinnedCount = block.match(/site_content_release_records where release_id = '[0-9a-f-]+'\) <> (\d+)/)?.[1];
  if (!pinnedDigest || !pinnedCount) throw new Error("Could not read the bootstrap population guard.");
  return {
    pinnedDigest,
    computedDigest: digest,
    pinnedCount: Number(pinnedCount),
    computedCount: count,
    matches: pinnedDigest === digest && Number(pinnedCount) === count,
  };
}

function blockPattern(tag: string) {
  return new RegExp(`(\\$${tag}\\$)[\\s\\S]*?(\\$${tag}\\$)`);
}

export function replaceBlock(sql: string, tag: string, body: string) {
  const pattern = blockPattern(tag);
  const matches = sql.match(new RegExp(`\\$${tag}\\$`, "g")) ?? [];
  if (matches.length !== 2) {
    throw new Error(`Expected exactly one $${tag}$ block, found ${matches.length / 2}.`);
  }
  // A blob carrying its own delimiter would terminate the quote early and turn the rest of
  // the seed into SQL. It has never happened; it must never happen silently.
  if (body.includes(`$${tag}$`)) throw new Error(`Refreshed ${tag} blob contains its own delimiter.`);
  if (/[\r\n]/.test(body)) throw new Error(`Refreshed ${tag} blob must be a single line.`);
  return sql.replace(pattern, (_match, open: string, close: string) => `${open}${body}${close}`);
}

function main() {
  const check = process.argv.includes("--check");
  const blobs: Array<[string, string]> = [
    ["site_content_registry_baselines", JSON.stringify(registryBaselines())],
    ["site_content_bootstrap_records", JSON.stringify(bootstrapRecords())],
  ];

  const entries = bootstrapRecords();
  const digest = bootstrapDigest(entries);

  const stale: string[] = [];
  for (const target of TARGETS) {
    const path = repoUrl(target);
    const current = readFileSync(path, "utf8");
    let next = current;
    for (const [tag, body] of blobs) next = replaceBlock(next, tag, body);
    if (next === current) continue;
    stale.push(target);
    if (!check) writeFileSync(path, next);
  }

  if (check) {
    if (stale.length) {
      console.error(
        `P03 seed baseline is stale in:\n  ${stale.join("\n  ")}\n` +
          "Run: npm run site-content:p03, then npm run drift:manifest (requires Docker).",
      );
      process.exit(1);
    }
    console.log("P03 seed baseline is current.");
    return;
  }

  if (!stale.length) {
    console.log("P03 seed baseline already current; nothing written.");
  } else {
    console.log(
      `Refreshed the P03 seed baseline in:\n  ${stale.join("\n  ")}\n` +
        "supabase/schema.sql changed, so run npm run drift:manifest (requires Docker) before pushing.",
    );
  }
  reportBootstrapRelease(readFileSync(repoUrl(SCHEMA), "utf8"), digest, entries.length);
}

/** Says out loud whether the seeded release still matches, and what it means if not. */
function reportBootstrapRelease(sql: string, digest: string, count: number) {
  const state = bootstrapReleaseState(sql, digest, count);
  if (state.matches) {
    console.log("Seeded bootstrap release matches the blob.");
    return;
  }
  console.warn(
    "\nWARNING: the seeded bootstrap release no longer describes this blob.\n" +
      `  guard expects digest ${state.pinnedDigest} over ${state.pinnedCount} records\n` +
      `  this blob computes  ${state.computedDigest} over ${state.computedCount} records\n` +
      "  supabase/schema.sql therefore will not replay: it aborts with\n" +
      "  site_content_bootstrap_population_mismatch, so npm run drift:manifest cannot run.\n" +
      "  This is NOT repaired here. The release UUID is derived from the digest, so moving it\n" +
      "  re-keys the bootstrap release identity across both SQL files and application code.\n" +
      "  That is an owner decision about the live clinical content control plane.\n",
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
