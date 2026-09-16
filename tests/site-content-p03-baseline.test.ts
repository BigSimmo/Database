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

/** Epoch-zero freeze the live database holds (see tests/site-content-epoch-zero-freeze.test.ts). */
const APPLIED_RELEASE_DIGEST = "57f6ec90225fc4341b446705f50a48b132f2872172d8f93888bf921fe7bfa1bc";
const APPLIED_RECORD_COUNT = 843;

const read = (path: string) => readFileSync(path, "utf8");
const block = (sql: string, tag: string) =>
  JSON.parse(sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))![1]!);

/**
 * `scripts/refresh-site-content-p03-baseline.ts` duplicates corpus-sync derivations so the
 * frozen P03 blobs can be reasoned about offline. These tests pin those derivations and the
 * digest math — they must NOT require the freeze to equal today's catalogue.
 *
 * That trap is exactly what caused PR #2814 to rewrite already-applied migrations: two tests
 * asserted frozen blobs equalled the current catalogue, so adding service records failed them
 * by construction. The freeze is pinned byte-for-byte by
 * `tests/site-content-epoch-zero-freeze.test.ts`; catalogue divergence is expected and must
 * reach live through the publication pipeline or a NEW forward migration, never by editing
 * `20260824122000`.
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

  it("keeps every seed field the migration reads", () => {
    const frozen = block(read(MIGRATION), "site_content_bootstrap_records") as Array<Record<string, unknown>>;
    const generated = bootstrapRecords();
    // Field vocabulary must stay aligned so a renamed seed column is caught. Length must NOT:
    // the freeze is a 2026-08-24 snapshot and the catalogue is free to grow past it.
    expect(frozen).toHaveLength(APPLIED_RECORD_COUNT);
    expect(generated.length, "the generator must still project today's catalogue").toBeGreaterThan(0);
    expect(Object.keys(generated[0]!).sort()).toEqual(Object.keys(frozen[0]!).sort());
    // Round-trip a frozen entry through bootstrapEntry: proves the derivation still reproduces
    // what the migration actually stores, without demanding the catalogue match the freeze.
    const sample = frozen.find((entry) => String(entry.logicalId).startsWith("forms:"))!;
    expect(sample.logicalDocumentId).toBe(deterministicUuid(`site-content-document:${sample.logicalId}`));
    expect(sample.logicalChunkId).toBe(deterministicUuid(`site-content-chunk:${sample.logicalId}`));
    expect(sample.logicalDocumentId).not.toBe(sample.logicalChunkId);
    expect(bootstrapEntry({ record: sample.record, renderPayload: sample.renderPayload } as never)).toEqual(sample);
  });

  it("still projects registry baselines with the key shape SQL looks up", () => {
    // Generator smoke: keeps registryBaselines() from rotting even though we refuse to write it
    // into the applied migration. Key shape matches site_content_registry_baseline's lookup.
    const generated = registryBaselines();
    const keys = Object.keys(generated);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !/^(?:service|form):[a-z0-9-]+$/.test(key))).toEqual([]);
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
 * real replays of the pinned supabase/postgres image. These tests keep that agreement from
 * rotting against the COMMITTED freeze, which matters because nothing in CI replays schema.sql.
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

  it("reproduces the digest a container replay computes for the frozen blob", () => {
    const frozen = block(read(MIGRATION), "site_content_bootstrap_records") as ReturnType<typeof bootstrapRecords>;
    expect(bootstrapDigest(frozen)).toBe(APPLIED_RELEASE_DIGEST);
  });

  it("keeps the seeded release identity describing the committed blob", () => {
    // schema.sql and the migration share one digest, one content-addressed release id, and one
    // population count for the freeze. A mismatch here is exactly the
    // site_content_bootstrap_population_mismatch preview branches abort on.
    const frozen = block(read(MIGRATION), "site_content_bootstrap_records") as ReturnType<typeof bootstrapRecords>;
    const digest = bootstrapDigest(frozen);
    const state = bootstrapReleaseState(read("supabase/schema.sql"), digest, frozen.length);
    expect(state.pinnedCount).toBe(APPLIED_RECORD_COUNT);
    expect(state.computedCount).toBe(APPLIED_RECORD_COUNT);
    expect(state.pinnedDigest).toBe(digest);
    expect(state.matches).toBe(true);
  });
});
