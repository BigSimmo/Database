import { describe, expect, it } from "vitest";

import {
  compareMigrations,
  hashMigrations,
  migrationFilenames,
  readManifest,
} from "../scripts/check-migration-immutability.mjs";

/**
 * Runs the applied-migration immutability guard inside the offline suite, so an edit to a shipped
 * migration fails in review rather than in the post-merge live drift check.
 *
 * The specific incident this generalises: on 2026-09-16 three already-applied migrations were
 * regenerated to absorb new catalogue records. Nothing offline objected — the migration replay
 * only proves the chain is internally consistent with itself, and the schema mirror was
 * regenerated from the same rewritten files, so the two agreed. Production, which never re-runs
 * an applied version, disagreed with both.
 *
 * If this fails, do not reach for `npm run migrations:seal`. A migration that has shipped has
 * been applied; changing the file cannot change what was applied. The change belongs in a NEW
 * migration. Resealing is for the narrow case of restoring a file to the bytes production holds,
 * and it is expected to be explained in the commit that does it.
 */
describe("shipped migrations are immutable", () => {
  it("matches every sealed migration byte for byte", () => {
    const sealed = (readManifest() as { versions: Record<string, string> }).versions;
    const result = compareMigrations(sealed, hashMigrations());
    expect(result.edited, "an already-shipped migration was edited").toEqual([]);
    expect(result.missing, "an already-shipped migration was deleted").toEqual([]);
    expect(result.unsealed, "a migration is not sealed — run npm run migrations:seal").toEqual([]);
  });

  it("seals every migration on disk", () => {
    // Non-vacuous: an empty or truncated manifest would otherwise pass the comparison above by
    // having nothing to disagree with.
    const sealed = (readManifest() as { versions: Record<string, string> }).versions;
    const onDisk = migrationFilenames();
    expect(onDisk.length).toBeGreaterThan(200);
    expect(Object.keys(sealed).sort()).toEqual([...onDisk].sort());
  });

  it("detects an edit, a deletion and an unsealed addition", () => {
    // The comparison is the whole guard, so it is tested directly rather than only exercised.
    const sealed = { a: "1", b: "2" };
    expect(compareMigrations(sealed, { a: "1", b: "2" })).toMatchObject({ ok: true });
    expect(compareMigrations(sealed, { a: "1", b: "changed" })).toMatchObject({ edited: ["b"], ok: false });
    expect(compareMigrations(sealed, { a: "1" })).toMatchObject({ missing: ["b"], ok: false });
    expect(compareMigrations(sealed, { a: "1", b: "2", c: "3" })).toMatchObject({ unsealed: ["c"], ok: false });
  });
});
