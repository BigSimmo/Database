import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  bootstrapEntry,
  bootstrapRecords,
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
