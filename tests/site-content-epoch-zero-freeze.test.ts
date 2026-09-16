import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The epoch-zero bootstrap is immutable, because the live database already holds it.
 *
 * WHAT HAPPENED, 2026-09-16. `npm run bootstrap:refresh --write` regenerated the frozen P03
 * population inside three ALREADY-APPLIED migrations, because two committed tests asserted the
 * freeze equalled the current catalogue and therefore failed the moment a service record was added.
 * The regeneration moved the release identity from `e4a1dd29-14f6-556c-8fb7-f4f947d8b846` (843
 * records, digest `57f6ec90…`) to `91ceaa8d-470c-5661-8ce6-980c2a1bb137` (860 records, digest
 * `da6d9b10…`) and it merged.
 *
 * WHY THAT IS NOT RECOVERABLE BY MERGING. The Supabase integration applies migration versions it
 * has not seen. `20260824122000` was applied on 2026-09-11, so editing the file changes nothing on
 * live and never will. The live database kept the old identity, the repository began describing a
 * release no database has ever held, and the post-merge `live-drift` gate went red on
 * `site_content_release_records_check1` and `site_content_sync_state_transition_pointer_check` —
 * the two constraints that embed the id. A replayed database (CI migration replay, a preview
 * branch, a disaster-recovery restore) would have carried the new identity while production
 * carried the old one, which is the silent-divergence class the drift programme exists to close.
 *
 * WHAT THIS GUARDS. These constants are what production holds. They are not a preference and they
 * are not regenerable: no catalogue change, no test failure, and no generator run may alter them.
 * Curated content reaches live through the publication pipeline in
 * `docs/site-content-sync-runbook.md`; a lookup that must serve newer records is refreshed by a NEW
 * forward migration, never by editing one of these three.
 *
 * If this test fails, do not update the constants. Restore the migration.
 */

/** The epoch-zero release id the live database holds. Applied 2026-09-11; immutable. */
const APPLIED_RELEASE_ID = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
/** The frozen release digest, which the release id is derived from. */
const APPLIED_RELEASE_DIGEST = "57f6ec90225fc4341b446705f50a48b132f2872172d8f93888bf921fe7bfa1bc";
/** Rows frozen into the release, asserted by the migration's own replay self-check. */
const APPLIED_RECORD_COUNT = 843;
/** Registry baseline entries frozen for SQL null and forced-field merging. */
const APPLIED_BASELINE_COUNT = 281;

const BOOTSTRAP_MIGRATION = "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql";
const HEALTH_PROBE_MIGRATION = "supabase/migrations/20260824123000_add_site_content_health_probe.sql";
const TRANSITIONS_MIGRATION = "supabase/migrations/20260830121000_bind_site_content_release_transitions.sql";
const SCHEMA_MIRROR = "supabase/schema.sql";
const DRIFT_MANIFEST = "supabase/drift-manifest.json";

const APPLIED_MIGRATIONS = [BOOTSTRAP_MIGRATION, HEALTH_PROBE_MIGRATION, TRANSITIONS_MIGRATION];
const QUOTED_UUID = /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/g;

const read = (path: string) => readFileSync(path, "utf8");

function blob(source: string, tag: string): string {
  const match = source.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  expect(match, `${tag} blob not found`).not.toBeNull();
  return match![1]!;
}

describe("the epoch-zero site-content freeze matches the live database", () => {
  it.each(APPLIED_MIGRATIONS)("pins only the applied release id in %s", (path) => {
    const distinct = [...new Set(read(path).match(QUOTED_UUID) ?? [])];
    // Non-vacuous: each of these three files really does name the release id, so an empty match
    // cannot pass as "no foreign id found".
    expect(distinct.length, `${path} should quote exactly one uuid`).toBe(1);
    expect(distinct[0], `${path} names a release id the live database does not hold`).toBe(`'${APPLIED_RELEASE_ID}'`);
  });

  it("pins the frozen release digest and population counts", () => {
    const migration = read(BOOTSTRAP_MIGRATION);
    expect(migration).toContain(APPLIED_RELEASE_DIGEST);
    expect(migration).toContain(`) <> ${APPLIED_RECORD_COUNT}`);
    expect(JSON.parse(blob(migration, "site_content_bootstrap_records")).length).toBe(APPLIED_RECORD_COUNT);
    expect(Object.keys(JSON.parse(blob(migration, "site_content_registry_baselines"))).length).toBe(
      APPLIED_BASELINE_COUNT,
    );
    expect(read(HEALTH_PROBE_MIGRATION)).toContain(`expected_record_count = ${APPLIED_RECORD_COUNT}`);
  });

  it("keeps the schema mirror and drift manifest on the same identity", () => {
    // The mirror is what a replay produces and the manifest is what `check:drift` compares against
    // live. If either names a different release, a replayed database and production disagree while
    // every offline check still passes — the exact shape of the 2026-09-16 failure.
    const mirror = read(SCHEMA_MIRROR);
    expect(mirror).toContain(APPLIED_RELEASE_ID);
    expect([...new Set(mirror.match(QUOTED_UUID) ?? [])]).toContain(`'${APPLIED_RELEASE_ID}'`);

    const manifest = read(DRIFT_MANIFEST);
    const constraints = ["site_content_release_records_check1", "site_content_sync_state_transition_pointer_check"];
    const pinned = (JSON.parse(manifest).snapshot.constraints as Array<{ name: string; def: string }>).filter(
      (constraint) => constraints.includes(constraint.name),
    );
    expect(pinned.length, "both release-bearing constraints must be in the manifest").toBe(constraints.length);
    for (const constraint of pinned) {
      expect(constraint.def, `${constraint.name} names a release the live database does not hold`).toContain(
        APPLIED_RELEASE_ID,
      );
    }
  });
});
