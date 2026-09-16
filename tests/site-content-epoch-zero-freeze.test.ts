import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The epoch-zero bootstrap is immutable, because the live database already holds it.
 *
 * WHAT HAPPENED, 2026-09-16. `npm run bootstrap:refresh -- --write` regenerated the frozen P03
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
 * forward migration, never by editing one of the four that pin this identity.
 *
 * IF THIS TEST FAILS, do not update the constants — restore the migration.
 *
 * TWO FORWARD-MIGRATION EXCEPTIONS, and both are remedies rather than a way round this test:
 * 1. A NEW forward migration may legitimately name this release id, because the integration applies
 *    new versions and that is how a lookup serving post-freeze records is refreshed. Such a file
 *    makes the sweep below fail on its file list, and the correct response is to ADD it to
 *    `APPLIED_MIGRATIONS`. The constants above still never change: a new migration references the
 *    frozen identity, it does not mint a different one.
 * 2. Retained-bootstrap multi-pin migrations (`RETAINED_BOOTSTRAP_PIN_MIGRATIONS`) may also name
 *    later regenerated ids (91ceaa8d, ddc94ecf) that a live / replayed database may still hold.
 *    Those ids widen CHECK / reader predicates only; they must never rewrite the epoch-zero seed.
 *    The schema mirror and drift-manifest CHECKs may therefore list the full retained set, while
 *    the frozen population itself stays on `APPLIED_RELEASE_ID`.
 */

/** The epoch-zero release id the live database holds. Applied 2026-09-11; immutable. */
const APPLIED_RELEASE_ID = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
/** The frozen release digest, which the release id is derived from. */
const APPLIED_RELEASE_DIGEST = "57f6ec90225fc4341b446705f50a48b132f2872172d8f93888bf921fe7bfa1bc";
/** Rows frozen into the release, asserted by the migration's own replay self-check. */
const APPLIED_RECORD_COUNT = 843;
/** Registry baseline entries frozen for SQL null and forced-field merging. */
const APPLIED_BASELINE_COUNT = 281;

/**
 * sha256 of each frozen blob's exact bytes. These are the real immutability pin, and counting
 * entries is not a substitute for them.
 *
 * The records blob is also covered at replay time by the migration's own
 * `site_content_bootstrap_digest` self-check. The BASELINES blob is covered by nothing else at
 * all: no digest hashes it, so before these pins existed, replacing all 281 values with `{}`,
 * shifting them by one, or re-keying every `service:` to `svc:` passed every offline gate. The
 * last one would have made every baseline lookup in `site_content_registry_source_render`
 * resolve to null and silently drop the forced-field merge, and only a post-merge `check:drift`
 * on the function body would have noticed — after it reached production.
 */
const APPLIED_RECORDS_BLOB_SHA256 = "9d265e095a0a3a5c9c97daabdf1a9b1bcce9506fee40c2412bc4159569a02e6f";
const APPLIED_BASELINES_BLOB_SHA256 = "66290d5ce5213a175747aa35b4bb60960006ebfed6a0408d721326c2371feb29";

const BOOTSTRAP_MIGRATION = "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql";
const HEALTH_PROBE_MIGRATION = "supabase/migrations/20260824123000_add_site_content_health_probe.sql";
const TRANSITIONS_MIGRATION = "supabase/migrations/20260830121000_bind_site_content_release_transitions.sql";
const SCHEMA_MIRROR = "supabase/schema.sql";
const DRIFT_MANIFEST = "supabase/drift-manifest.json";

/**
 * Every migration that names the release. `20260916103000` matters as much as the original three:
 * PR #2814 rewrote the first three and left it alone, so a replayed database got a bootstrap the
 * catalogue read could never match and the epoch-zero branch of
 * `read_site_content_public_records` silently returned nothing. Nothing detected that.
 */
const APPLIED_MIGRATIONS = [
  BOOTSTRAP_MIGRATION,
  HEALTH_PROBE_MIGRATION,
  TRANSITIONS_MIGRATION,
  "supabase/migrations/20260916103000_push_kind_filter_into_site_content_public_records.sql",
];
/** Later regenerated ids a live / replayed DB may still hold; never remove, never mint another. */
const RETAINED_BOOTSTRAP_RELEASE_IDS = [
  APPLIED_RELEASE_ID,
  "91ceaa8d-470c-5661-8ce6-980c2a1bb137",
  "ddc94ecf-3527-5b4d-846b-af5724b428ca",
] as const;
/** Forward migrations that widen CHECKs / readers to the retained set without rewriting the freeze. */
const RETAINED_BOOTSTRAP_PIN_MIGRATIONS = [
  "supabase/migrations/20260916143000_dual_pin_retained_bootstrap_check_constraints.sql",
  "supabase/migrations/20260916160000_triple_pin_retained_bootstrap_release_ids.sql",
];
const QUOTED_UUID = /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/g;
/** All-zero / all-one style placeholders the retrieval migrations use as owner sentinels. */
const SENTINEL_UUID = /^'([0-9a-f])\1{7}-\1{4}-[0-9a-f]\1{3}-[0-9a-f]\1{3}-\1{12}'$/;

const read = (path: string) => readFileSync(path, "utf8");

function blob(source: string, tag: string): string {
  const match = source.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  expect(match, `${tag} blob not found`).not.toBeNull();
  return match![1]!;
}

describe("the epoch-zero site-content freeze matches the live database", () => {
  it.each(APPLIED_MIGRATIONS)("pins only the applied release id in %s", (path) => {
    const distinct = [...new Set(read(path).match(QUOTED_UUID) ?? [])];
    // Non-vacuous: each of these files really does name the release id, so an empty match cannot
    // pass as "no foreign id found".
    expect(distinct.length, `${path} should quote exactly one uuid`).toBe(1);
    expect(distinct[0], `${path} names a release id the live database does not hold`).toBe(`'${APPLIED_RELEASE_ID}'`);
  });

  it("lets no migration anywhere introduce a second release identity", () => {
    // Stronger than the per-file check above and the reason it is here: a regeneration can add a
    // file, and a list of known files cannot see that. Across the whole migration set the only
    // real uuids are the retained bootstrap set; everything else is an owner sentinel.
    const retainedQuoted = new Set(RETAINED_BOOTSTRAP_RELEASE_IDS.map((id) => `'${id}'`));
    const offenders: string[] = [];
    const namingApplied: string[] = [];
    const namingRetainedPin: string[] = [];
    for (const name of readdirSync(new URL("../supabase/migrations/", import.meta.url)).sort()) {
      if (!name.endsWith(".sql")) continue;
      const path = `supabase/migrations/${name}`;
      for (const quoted of new Set(read(path).match(QUOTED_UUID) ?? [])) {
        if (quoted === `'${APPLIED_RELEASE_ID}'`) {
          if (RETAINED_BOOTSTRAP_PIN_MIGRATIONS.includes(path)) namingRetainedPin.push(path);
          else namingApplied.push(path);
        } else if (retainedQuoted.has(quoted)) {
          if (!RETAINED_BOOTSTRAP_PIN_MIGRATIONS.includes(path)) {
            offenders.push(`${path}: ${quoted}`);
          } else {
            namingRetainedPin.push(path);
          }
        } else if (!SENTINEL_UUID.test(quoted)) {
          offenders.push(`${path}: ${quoted}`);
        }
      }
    }
    expect(
      offenders,
      "a migration quotes a uuid that is neither a retained bootstrap release nor a sentinel",
    ).toEqual([]);
    // Non-vacuous: the sweep must actually have seen the release, or an accidental deletion of it
    // everywhere would read as "no offenders". A NEW forward migration that legitimately names the
    // release belongs in APPLIED_MIGRATIONS — see the exception in this file's header.
    expect(
      [...new Set(namingApplied)].sort(),
      "a migration names the release id without being listed in APPLIED_MIGRATIONS (a new forward migration may; a regeneration may not)",
    ).toEqual([...APPLIED_MIGRATIONS].sort());
    expect(
      [...new Set(namingRetainedPin)].sort(),
      "retained-bootstrap pin migrations must stay listed when they name retained ids",
    ).toEqual([...RETAINED_BOOTSTRAP_PIN_MIGRATIONS].sort());
  });

  it("refuses to regenerate the freeze", () => {
    // The lesson of the incident currently rests on one `if` in the generator. Without this,
    // deleting that `if` leaves every other gate green and the next catalogue change rewrites
    // applied history again. Runs the real script rather than grepping it, so a refusal that
    // throws but still writes, or an exit code of 0, fails here too.
    const result = spawnSync(
      process.execPath,
      ["scripts/run-tsx.mjs", "scripts/refresh-site-content-bootstrap.ts", "--write"],
      { encoding: "utf8", timeout: 120_000 },
    );
    expect(result.status, "bootstrap:refresh --write must exit non-zero").not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Refusing to rewrite an applied migration");
    // And it must not have touched the files it used to rewrite. Checked by hash, not by
    // substring: this test runs the real writer, so if both barriers in it were ever removed
    // at once, the run itself would rewrite tracked migrations and a substring check would
    // still pass on the new content.
    const migration = read(BOOTSTRAP_MIGRATION);
    const sha = (text: string) => createHash("sha256").update(text).digest("hex");
    expect(sha(blob(migration, "site_content_bootstrap_records"))).toBe(APPLIED_RECORDS_BLOB_SHA256);
    expect(sha(blob(migration, "site_content_registry_baselines"))).toBe(APPLIED_BASELINES_BLOB_SHA256);
    for (const path of APPLIED_MIGRATIONS) expect(read(path)).toContain(APPLIED_RELEASE_ID);
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

  it("pins both frozen blobs byte for byte", () => {
    // Counting entries says nothing about their contents. This is what actually holds the
    // freeze immutable offline, and for the baselines blob it is the only thing that does.
    const migration = read(BOOTSTRAP_MIGRATION);
    const sha = (text: string) => createHash("sha256").update(text).digest("hex");
    expect(sha(blob(migration, "site_content_bootstrap_records")), "the frozen seed population changed").toBe(
      APPLIED_RECORDS_BLOB_SHA256,
    );
    expect(sha(blob(migration, "site_content_registry_baselines")), "the frozen registry baselines changed").toBe(
      APPLIED_BASELINES_BLOB_SHA256,
    );
  });

  it("keeps every frozen baseline key in the shape SQL looks it up by", () => {
    // site_content_registry_baseline resolves `p_kind || ':' || lower(btrim(p_slug))`, so a
    // re-keyed blob returns null for every record and the forced-field merge silently vanishes.
    const keys = Object.keys(JSON.parse(blob(read(BOOTSTRAP_MIGRATION), "site_content_registry_baselines")));
    expect(keys.filter((key) => !/^(?:service|form):[a-z0-9-]+$/.test(key))).toEqual([]);
    expect(keys.filter((key) => key.startsWith("service:")).length).toBeGreaterThan(0);
    expect(keys.filter((key) => key.startsWith("form:")).length).toBeGreaterThan(0);
  });

  it("recognises exactly the release ids a database may hold", () => {
    // Adding another id is how a regeneration would make itself pass. The generator used to
    // demand exactly that, in a message that contradicted the module's own rule; it no longer
    // does, and this makes a new id a deliberate test edit rather than a quiet one.
    // Scoped to the declaration rather than the whole file, so a uuid appearing in a comment
    // somewhere else in the module does not fail a test about the recognised set.
    // Never remove an id a live / replayed database may hold (see RETAINED_BOOTSTRAP_RELEASE_IDS).
    const healthModule = read("src/lib/site-content/site-content-health.ts");
    const declaration = healthModule.match(/RETAINED_BOOTSTRAP_RELEASE_IDS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
    expect(declaration, "RETAINED_BOOTSTRAP_RELEASE_IDS is no longer a literal Set").not.toBeNull();
    const ids = declaration![1]!.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [];
    expect(ids).toEqual([...RETAINED_BOOTSTRAP_RELEASE_IDS]);
  });

  it("keeps the schema mirror and drift manifest on the same identity", () => {
    // The mirror is what a replay produces and the manifest is what `check:drift` compares against
    // live. The frozen seed must stay on APPLIED_RELEASE_ID; retained multi-pin CHECKs / readers
    // may also name later ids a live database may hold. Any uuid outside that set is the exact
    // silent-divergence shape of the 2026-09-16 failure.
    const retainedQuoted = new Set(RETAINED_BOOTSTRAP_RELEASE_IDS.map((id) => `'${id}'`));
    const mirror = read(SCHEMA_MIRROR);
    const mirrored = [...new Set(mirror.match(QUOTED_UUID) ?? [])];
    expect(mirrored, "the mirror must still name the applied release").toContain(`'${APPLIED_RELEASE_ID}'`);
    expect(
      mirrored.filter((quoted) => !retainedQuoted.has(quoted) && !SENTINEL_UUID.test(quoted)),
      "the schema mirror names a release outside the retained bootstrap set",
    ).toEqual([]);
    // Seed / active pointers must still be the production-held freeze, not a regenerated id.
    expect(mirror).toContain(`'${APPLIED_RELEASE_ID}', 'active'`);
    expect(mirror).toContain(APPLIED_RELEASE_DIGEST);

    const manifest = read(DRIFT_MANIFEST);
    const constraints = ["site_content_release_records_check1", "site_content_sync_state_transition_pointer_check"];
    const pinned = (JSON.parse(manifest).snapshot.constraints as Array<{ name: string; def: string }>).filter(
      (constraint) => constraints.includes(constraint.name),
    );
    expect(pinned.length, "both release-bearing constraints must be in the manifest").toBe(constraints.length);
    for (const constraint of pinned) {
      expect(constraint.def, `${constraint.name} must keep the production-held freeze`).toContain(APPLIED_RELEASE_ID);
      for (const id of RETAINED_BOOTSTRAP_RELEASE_IDS) {
        expect(constraint.def, `${constraint.name} must retain ${id} for live drift`).toContain(id);
      }
    }
  });
});
