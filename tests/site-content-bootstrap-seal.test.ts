import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the 2026-09-16 latency fix: the public registry read path must never again walk the
 * 843-row frozen epoch-zero population on every request.
 *
 * WHAT WAS WRONG. `read_site_content_public_records` is the single read path behind all seven
 * public registry GET routes, universal search and the differential page loader, and in the live
 * epoch-zero state it walked the whole bootstrap population THREE times per call:
 *   1. `public.site_content_bootstrap_digest(r.id)` in its own `transition` CTE;
 *   2. the same digest again through `site_content_current_transition_kind` ->
 *      `site_content_retained_bootstrap_valid`;
 *   3. that function's per-row structural sweep, which detoasts every row's `record` jsonb.
 * Each digest evaluation canonicalises 9,522,923 bytes / 164,820 JSON nodes through the RECURSIVE
 * plpgsql `site_content_canonical_json`. Production measured ~4.2 s per registry request,
 * including an 8 KB single-record detail, and psychiatry.tools was visibly broken by it.
 *
 * WHAT REPLACED IT. `20260916190000_seal_bootstrap_release_and_drop_per_read_digest.sql` verifies
 * the population cryptographically once inside its own transaction, then seals the rows against
 * INSERT and TRUNCATE with `enable always` triggers, and points the read path at the cheap
 * `site_content_retained_bootstrap_sealed` predicate (release metadata + the O(1) release_id <->
 * release_digest binding + one index-only count).
 *
 * WHY THIS IS A STRUCTURAL TEST. The behaviour lives in Postgres and CI's migration replay is what
 * executes it. This class of regression is invisible in review — the digest call reads as
 * defensive, not as a 9.5 MB-per-request cost — which is exactly how the `coalesce`-over-left-join
 * regression before it survived review and caused a seven-day outage.
 *
 * IF THIS FAILS, do not delete the assertion. Either a digest/sweep has come back onto the read
 * path (put it back in `read_site_content_health()` instead), or the seal that makes its absence
 * safe has been removed.
 */

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const SEAL_MIGRATION = "20260916190000_seal_bootstrap_release_and_drop_per_read_digest.sql";
const RETAINED_BOOTSTRAP_RELEASE_IDS = [
  "e4a1dd29-14f6-556c-8fb7-f4f947d8b846",
  "91ceaa8d-470c-5661-8ce6-980c2a1bb137",
  "ddc94ecf-3527-5b4d-846b-af5724b428ca",
] as const;

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * SQL with `--` comments removed. Every assertion below runs against this, because the migration
 * deliberately documents the removed call by name (`-- Was: r.release_digest =
 * public.site_content_bootstrap_digest(r.id).`). A raw substring check would pass on the comment
 * and would equally pass on the real call coming back with a comment beside it.
 */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** The body of the most recent migration that defines `public.<name>` — i.e. what live holds. */
function latestDefinition(name: string): { version: string; body: string } {
  const files = readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  let latest: { version: string; body: string } | null = null;
  for (const file of files) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8");
    const start = sql.indexOf(`create or replace function public.${name}(`);
    if (start === -1) continue;
    const end = sql.indexOf("\n$$;", start);
    expect(end, `${file} defines ${name} without a terminating $$;`).toBeGreaterThan(start);
    latest = { version: file, body: stripComments(sql.slice(start, end + 4)) };
  }
  if (!latest) throw new Error(`No migration defines public.${name}.`);
  return latest;
}

/** The LAST definition in the single-file mirror, which is the one a replay leaves behind. */
function mirrorDefinition(name: string): string {
  const mirror = read("../supabase/schema.sql");
  const head = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, "g");
  const starts = [...mirror.matchAll(head)].map((match) => match.index!);
  expect(starts.length, `supabase/schema.sql does not define public.${name}`).toBeGreaterThan(0);
  const start = starts[starts.length - 1]!;
  const end = mirror.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return stripComments(mirror.slice(start, end + 4));
}

describe("the public registry read path no longer hashes the frozen population per request", () => {
  const reader = latestDefinition("read_site_content_public_records");
  const transitionKind = latestDefinition("site_content_current_transition_kind");

  it("is the seal migration that defines the live reader and transition classifier", () => {
    // Non-vacuous: every assertion below is about "the newest definition", so if a later migration
    // redefines either function this test must be re-read against it rather than quietly passing.
    expect(reader.version).toBe(SEAL_MIGRATION);
    expect(transitionKind.version).toBe(SEAL_MIGRATION);
  });

  it("the reader never calls site_content_bootstrap_digest", () => {
    // Cost site A: one 9.5 MB canonicalisation per call, in the `transition` CTE.
    expect(reader.body).not.toContain("site_content_bootstrap_digest");
  });

  it("the transition-kind path never calls site_content_bootstrap_digest, directly or through _valid", () => {
    // Cost site B: the same 9.5 MB canonicalisation again, reached through
    // site_content_retained_bootstrap_valid, plus cost site C, that function's per-row sweep.
    expect(transitionKind.body).not.toContain("site_content_bootstrap_digest");
    expect(transitionKind.body).not.toContain("site_content_retained_bootstrap_valid");
    expect(transitionKind.body).toContain("public.site_content_retained_bootstrap_sealed(");
  });

  it("the sealed predicate carries neither the aggregate digest nor the per-row structural sweep", () => {
    const sealed = latestDefinition("site_content_retained_bootstrap_sealed");
    expect(sealed.version).toBe(SEAL_MIGRATION);
    expect(sealed.body).not.toContain("site_content_bootstrap_digest");
    // The sweep is what detoasted all 843 `record` jsonb values on every request. This single
    // predicate is its signature, and it is the one most likely to be "restored" by a reviewer who
    // reads its absence as an oversight.
    expect(sealed.body).not.toContain("rr.record->>'body'");
    expect(sealed.body).not.toContain("not exists");
  });

  it("keeps the cheap proof that replaced them, in both the reader and the sealed predicate", () => {
    // The release id is a content address of the digest, so this four-key hash is what makes
    // release_digest unforgeable against the pinned id. Dropping it would make the removal unsafe.
    const binding = "public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')";
    expect(reader.body).toContain(binding);
    expect(latestDefinition("site_content_retained_bootstrap_sealed").body).toContain(binding);
  });

  it("decides validity without aggregating over the population at all", () => {
    // The first draft of this fix replaced the digest with `expected_record_count = (select
    // count(*) ...)`. That is cheap — and it is the SAME SHAPE as the defect: per-request
    // re-verification of immutable data that scales with the corpus. It is also the wrong
    // direction of proof, because site_content_releases has no immutability trigger while the
    // release records do, so the count compares a mutable column against sealed rows.
    // scripts/check-read-path-cost.mjs rule R3 caught it before merge, which is how it came out.
    // R3 no longer flags that shape: an adversarial review found the rule rejected ordinary reads
    // — a count of one row by primary key, a single-document fetch — and the runbook explicitly
    // permits an index-only count against a stored expected count on a read path, so the rule was
    // narrowed to genuinely unfiltered scans. Nothing enforces this particular removal any more
    // except the assertions below, which is why they are here rather than left to the gate.
    expect(reader.body).not.toMatch(/count\s*\(/);
    const sealed = latestDefinition("site_content_retained_bootstrap_sealed").body;
    expect(sealed).not.toMatch(/count\s*\(/);
    // Stronger, and the assertion that actually holds the shape: the sealed predicate must not
    // read the population table on any code path. It decides from site_content_releases alone.
    expect(sealed).not.toContain("site_content_release_records");
  });

  it("keeps the fail-closed switch and the security boundary intact", () => {
    // `transition.valid` false must still blank every record column and report 'unavailable'
    // rather than serve suspect clinical content.
    expect(reader.body).toContain("where s.valid");
    expect(reader.body).toContain("when not s.valid then 'unavailable'");
    expect(reader.body).toContain("security definer");
    expect(reader.body).toContain("set search_path = ''");
  });
});

describe("the seal that makes the per-read verification unnecessary", () => {
  const migration = readFileSync(new URL(SEAL_MIGRATION, migrationsDir), "utf8");
  const sql = stripComments(migration);

  it("verifies the population cryptographically BEFORE it installs anything", () => {
    // Verify-then-seal. If live has drifted, the migration must abort rather than bless it — and
    // merging reaches the live clinical database within seconds, so ordering is the whole control.
    const verify = sql.indexOf("site_content_bootstrap_population_mismatch_at_seal");
    const seal = sql.indexOf("create trigger site_content_release_records_bootstrap_sealed");
    const repoint = sql.indexOf("site_content_retained_bootstrap_sealed(p_active_release_id");
    expect(verify).toBeGreaterThan(-1);
    expect(seal).toBeGreaterThan(verify);
    expect(repoint).toBeGreaterThan(verify);
    // The verification block is the one place the expensive proofs still run in this file, and it
    // must carry ALL of them: the digest, the per-row structural sweep, and the row count that the
    // read path no longer performs.
    const block = sql.slice(0, verify);
    expect(block).toContain("public.site_content_bootstrap_digest(v_release_id)");
    expect(block).toContain("rr.record->>'body' is distinct from rr.normalized_text");
    expect(block).toContain("select count(*)::integer from public.site_content_release_records rr");
    expect(block).toContain("public.site_content_release_id(v_release_digest, 0, 'bootstrap-v1')");
  });

  it("blocks INSERT into every retained bootstrap release", () => {
    expect(sql).toContain("create trigger site_content_release_records_bootstrap_sealed");
    expect(sql).toContain("before insert on public.site_content_release_records");
    for (const id of RETAINED_BOOTSTRAP_RELEASE_IDS) {
      expect(sql, `the INSERT seal must cover retained release ${id}`).toContain(`new.release_id = '${id}'::uuid`);
    }
  });

  it("blocks TRUNCATE, which the row-level immutability trigger cannot see", () => {
    expect(sql).toContain("create trigger site_content_release_records_no_truncate");
    expect(sql).toContain("before truncate on public.site_content_release_records");
    expect(sql).toContain("for each statement");
  });

  it("makes both guards survive session_replication_role = replica", () => {
    // The existing site_content_release_records_immutable trigger is NOT `enable always` and is
    // bypassable that way; a seal that is equally bypassable would be decorative.
    expect(sql).toContain("enable always trigger site_content_release_records_bootstrap_sealed");
    expect(sql).toContain("enable always trigger site_content_release_records_no_truncate");
  });

  it("runs in one transaction with bounded timeouts and no CONCURRENTLY", () => {
    expect(sql).toContain("set local search_path = public, pg_catalog;");
    expect(sql).toContain("set local lock_timeout = ");
    expect(sql).toContain("set local statement_timeout = ");
    expect(sql).not.toMatch(/create\s+index\s+concurrently/i);
    expect(sql).not.toMatch(/\b(commit|begin)\b\s*;/i);
  });

  it("restates the grants and ownership of every function it replaces", () => {
    // create or replace preserves privileges, but these are security-definer functions and one of
    // them is reachable by anon, so the grants ARE the security boundary.
    for (const signature of [
      "public.read_site_content_public_records(text, text)",
      "public.site_content_current_transition_kind(text, uuid, text, boolean, bigint)",
      "public.site_content_retained_bootstrap_valid(uuid, text)",
      "public.site_content_retained_bootstrap_sealed(uuid, text)",
    ]) {
      expect(sql, `${signature} must be revoked from public`).toContain(
        `revoke all on function ${signature}\n  from public, anon, authenticated, service_role;`,
      );
      expect(sql, `${signature} must be owned by postgres`).toContain(`alter function ${signature}`);
      expect(sql).toContain("owner to postgres;");
    }
    // Only the ownerless public projection is granted back, exactly as before.
    expect(sql).toContain(
      "grant execute on function public.read_site_content_public_records(text, text) to anon, authenticated, service_role;",
    );
    expect(sql).not.toContain("grant execute on function public.site_content_retained_bootstrap_sealed");
  });

  it("does not weaken RLS or touch owner scoping", () => {
    expect(sql).not.toMatch(/disable\s+row\s+level\s+security/i);
    expect(sql).not.toMatch(/no\s+force\s+row\s+level\s+security/i);
    expect(sql).not.toMatch(/drop\s+policy/i);
    expect(sql).not.toMatch(/security\s+invoker/i);
  });

  it("carries the header sections this repository's migrations are reviewed by", () => {
    for (const heading of ["-- WHY.", "-- THE CHANGE.", "-- LOCKS.", "-- HOW TO UNDO IT", "-- NOT DONE HERE."]) {
      expect(migration, `the header is missing ${heading}`).toContain(heading);
    }
  });
});

describe("the latent fail-closed trap the reader could still hit", () => {
  // 20260916143000 / 20260916160000 widened the CHECK constraints and the reader to all three
  // retained ids, but left these two functions pinned to e4a1dd29 alone. A database seeded with
  // either other retained id therefore got transition_kind = null, transition.valid = false, and
  // every public catalogue read silently returned NOTHING — the same outage shape those migrations
  // were written to prevent, reached through a different door.
  for (const name of [
    "site_content_retained_bootstrap_valid",
    "site_content_retained_bootstrap_sealed",
    "site_content_current_transition_kind",
  ]) {
    it(`${name} accepts every retained bootstrap release id`, () => {
      const body = latestDefinition(name).body;
      for (const id of RETAINED_BOOTSTRAP_RELEASE_IDS) {
        expect(body, `${name} must accept retained release ${id}`).toContain(id);
      }
    });
  }
});

describe("supabase/schema.sql mirrors the migration", () => {
  const migration = stripComments(readFileSync(new URL(SEAL_MIGRATION, migrationsDir), "utf8"));
  const mirror = read("../supabase/schema.sql");

  it("mirrors all four function bodies the migration leaves behind", () => {
    for (const name of [
      "read_site_content_public_records",
      "site_content_current_transition_kind",
      "site_content_retained_bootstrap_valid",
      "site_content_retained_bootstrap_sealed",
    ]) {
      const mirrored = mirrorDefinition(name);
      // Compare the executable text, whitespace-normalised: the mirror writes `create function`
      // where the migration writes `create or replace function`, and that is the only licensed
      // difference. Anything else is the chain-vs-mirror divergence class that reached main on
      // 2026-09-01 and was caught only by the post-merge live-drift alarm.
      const start = migration.indexOf(`create or replace function public.${name}(`);
      expect(start, `the migration must define public.${name}`).toBeGreaterThan(-1);
      const fromMigration = migration.slice(start, migration.indexOf("\n$$;", start) + 4);
      const normalise = (sql: string) =>
        sql
          .replace(/create or replace function/, "create function")
          .replace(/\s+/g, " ")
          .trim();
      expect(normalise(mirrored), `supabase/schema.sql diverges from ${SEAL_MIGRATION} for ${name}`).toBe(
        normalise(fromMigration),
      );
    }
  });

  it("places the INSERT seal AFTER the bootstrap seed insert", () => {
    // THE PLACEMENT TRAP. The sibling immutability trigger can sit beside the table because it
    // only covers UPDATE and DELETE. An INSERT trigger there would make a fresh replay of this
    // mirror fail on its own 843-row seed. In the migration chain the ordering is automatic;
    // here it is manual, and nothing but this assertion holds it.
    const seed = mirror.indexOf("insert into public.site_content_release_records(");
    const seal = mirror.indexOf("create trigger site_content_release_records_bootstrap_sealed");
    const truncate = mirror.indexOf("create trigger site_content_release_records_no_truncate");
    expect(seed).toBeGreaterThan(-1);
    expect(seal, "the INSERT seal must come after the bootstrap seed insert").toBeGreaterThan(seed);
    expect(truncate).toBeGreaterThan(seed);
    // And after the generated block's end marker, so `bootstrap:refresh` can never rewrite it.
    expect(seal).toBeGreaterThan(mirror.indexOf("-- END GENERATED SITE CONTENT BOOTSTRAP RELEASE"));
  });

  it("mirrors the guards, their enable-always state and the prefix index", () => {
    expect(mirror).toContain("create or replace function public.guard_site_content_sealed_bootstrap()");
    expect(mirror).toContain("enable always trigger site_content_release_records_bootstrap_sealed");
    expect(mirror).toContain("enable always trigger site_content_release_records_no_truncate");
    expect(mirror).toContain("create index site_content_release_records_public_prefix_idx");
    expect(mirror).toContain("on public.site_content_release_records(release_id, logical_id text_pattern_ops)");
    expect(migration).toContain("create index site_content_release_records_public_prefix_idx");
  });

  it("keeps the new security-definer predicate closed to public in the mirror", () => {
    // The schema-wide blanket revoke runs long before these definitions, so a per-function revoke
    // is the only thing standing between a security-definer function and PUBLIC's default EXECUTE.
    expect(mirror).toContain(
      "revoke all on function public.site_content_retained_bootstrap_sealed(uuid, text)\n  from public, anon, authenticated, service_role;",
    );
    expect(mirror).toContain(
      "alter function public.site_content_retained_bootstrap_sealed(uuid, text) owner to postgres;",
    );
  });
});
