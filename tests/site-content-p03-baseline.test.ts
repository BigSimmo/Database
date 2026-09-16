import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  bootstrapDigest,
  bootstrapEntry,
  bootstrapRecords,
  bootstrapReleaseState,
  canonicalJson,
  deterministicUuid,
  registryBaselines,
  replaceBlock,
} from "../scripts/refresh-site-content-p03-baseline";

const MIGRATION = "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql";
const CORPUS_SYNC = "scripts/sync-site-content-corpus.ts";

const read = (path: string) => readFileSync(path, "utf8");
const block = (sql: string, tag: string) =>
  JSON.parse(sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))![1]!);

/**
 * `supabase/migrations/20260824122000...sql` and `supabase/schema.sql` embed the whole
 * site-content seed population as dollar-quoted JSON, and two other tests pin it to the
 * live runtime records. So any Forms or Services content edit turns those red until the
 * blobs are refreshed, and for a long time there was no supported way to refresh them:
 * `canonicalDynamicSiteContentProjection` returns `record` and `renderPayload`, while a
 * frozen entry also carries two deterministic UUIDs, the normalised text, the content hash
 * and three fingerprints. Those seven come from `sourceRecord` in
 * `scripts/sync-site-content-corpus.ts`, which only ever writes to a provider.
 *
 * `scripts/refresh-site-content-p03-baseline.ts` duplicates those derivations so the blobs
 * can be regenerated offline. Duplicated derivations drift, and a drifted one here would
 * silently reseed the live public-records table with wrong identities. These tests are what
 * stops that: the derivations are pinned against the corpus-sync source, and the generated
 * entries are pinned against what is actually committed in the migration.
 */
describe("P03 seed baseline refresh", () => {
  it("derives the seed identity fields exactly as the corpus sync does", () => {
    const sync = read(CORPUS_SYNC);
    // The UUID seeds. A changed prefix silently repoints every document and chunk.
    expect(sync).toContain("`site-content-document:${record.logicalId}`");
    expect(sync).toContain("`site-content-chunk:${record.logicalId}`");
    // The three fingerprint inputs, in the order siteContentValueHash receives them.
    expect(sync).toContain("route: record.route,");
    expect(sync).toContain("title: record.title,");
    expect(sync).toContain("sourceRole: record.sourceRole,");
    expect(sync).toContain("access: record.access,");
    expect(sync).toContain("validationStatus: record.validationStatus,");
    expect(sync).toContain("sourceStatus: record.sourceStatus,");
    expect(sync).toContain("lineageFingerprint: siteContentValueHash(record.sourceLineage)");
    // The UUID v5-shaped derivation, copied character for character.
    const shared = sync.slice(sync.indexOf("function deterministicUuid"));
    for (const line of [
      'const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");',
      'hex[12] = "5";',
      'hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);',
    ]) {
      expect(shared).toContain(line);
    }
  });

  it("reproduces the committed migration blobs exactly", () => {
    const sql = read(MIGRATION);
    expect(block(sql, "site_content_registry_baselines")).toEqual(registryBaselines());
    expect(block(sql, "site_content_bootstrap_records")).toEqual(bootstrapRecords());
  });

  it("keeps every seed field the migration reads", () => {
    const frozen = block(read(MIGRATION), "site_content_bootstrap_records") as Array<Record<string, unknown>>;
    const generated = bootstrapRecords();
    expect(generated).toHaveLength(frozen.length);
    expect(Object.keys(generated[0]!)).toEqual(Object.keys(frozen[0]!));
    // The seed's own identity, not a value copied out of the record it describes.
    const sample = generated.find((entry) => entry.logicalId.startsWith("forms:"))!;
    expect(sample.logicalDocumentId).toBe(deterministicUuid(`site-content-document:${sample.logicalId}`));
    expect(sample.logicalChunkId).toBe(deterministicUuid(`site-content-chunk:${sample.logicalId}`));
    expect(sample.logicalDocumentId).not.toBe(sample.logicalChunkId);
    expect(bootstrapEntry({ record: sample.record, renderPayload: sample.renderPayload } as never)).toEqual(sample);
  });

  it("refuses a blob that would break out of its own dollar quote", () => {
    const sql = "as $$ select $tag$old$tag$::jsonb $$;";
    expect(() => replaceBlock(sql, "tag", "has a $tag$ inside")).toThrow(/its own delimiter/i);
    expect(() => replaceBlock(sql, "tag", "two\nlines")).toThrow(/single line/i);
    expect(replaceBlock(sql, "tag", "new")).toBe("as $$ select $tag$new$tag$::jsonb $$;");
  });
});

/**
 * `canonicalJson` and `bootstrapDigest` reimplement two SQL functions in JavaScript so the
 * seeded release's digest can be checked without a container. They were validated against
 * real replays of the pinned supabase/postgres image on two different datasets: the blob
 * committed before this branch hashed to b3caf89c... both in SQL and here, and the blob
 * this branch generates hashes to b0ff995b... both in SQL and here. These tests keep that
 * agreement from rotting, which matters because nothing in CI replays schema.sql.
 */
describe("bootstrap release digest", () => {
  it("canonicalises the way site_content_canonical_json does", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson([])).toBe("[]");
    expect(canonicalJson({})).toBe("{}");
    // Keys sort by byte order under collate "C", so every uppercase letter precedes every
    // lowercase one. A locale sort would interleave them and change the hash.
    expect(canonicalJson({ b: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"b":1}');
    // Arrays keep their order; only object keys are sorted.
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalJson({ outer: { z: [{ b: null, a: "x" }] } })).toBe('{"outer":{"z":[{"a":"x","b":null}]}}');
  });

  it("reproduces the digest a container replay computes for this blob", () => {
    // Verified 2026-09-16 against supabase/postgres:17.6.1.127, by making the population
    // guard report public.site_content_bootstrap_digest instead of aborting silently.
    expect(bootstrapDigest(bootstrapRecords())).toBe(
      "b0ff995bd05073c30eb62ac1338a374706fc2c01cea8a37bb9b8f2c9a9b860cc",
    );
  });

  it("reports, without repairing, that the seeded release no longer describes the blob", () => {
    // supabase/schema.sql does not replay, and has not since before this branch: the
    // committed guard expects a digest the committed blob does not produce. Repairing it
    // re-keys the release UUID, which is derived from the digest, so the script says so
    // rather than trading one broken invariant for another.
    const state = bootstrapReleaseState(read("supabase/schema.sql"), bootstrapDigest(bootstrapRecords()), 843);
    expect(state.pinnedCount).toBe(843);
    expect(state.computedCount).toBe(843);
    expect(state.matches).toBe(false);
    expect(state.pinnedDigest).not.toBe(state.computedDigest);
  });
});
