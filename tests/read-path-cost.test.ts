/**
 * The read-path cost contract.
 *
 * Between 2026-09-09 and 2026-09-16 every catalogue request on psychiatry.tools took
 * seconds instead of milliseconds, because `read_site_content_public_records()` — the
 * function behind every catalogue and search read — re-derived a SHA-256 over the
 * entire release corpus on every call, to re-confirm that immutable, already-verified
 * data still hashed to the value stored beside it. The cost is measured only as a
 * handful of browser probes against production on 2026-09-16 (roughly 4.2 s for a
 * catalogue read, 4.5-6.5 s across repeats) — a range, not a distribution; no
 * `EXPLAIN (ANALYZE)` has been run. What is established by reconstruction and hash is
 * the shape and size of the work: 9.52 MB canonicalised through recursive plpgsql,
 * twice per call. Nothing in this repository measured or refused that. The kind-filter
 * regression on the same function had been caught structurally only after a seven-day
 * outage; this one was caught by a human with a browser, a week in
 * (docs/audit/2026-09-16-catalogue-read-latency.md).
 *
 * `scripts/check-read-path-cost.mjs` is the guard built from that incident. This file
 * does two things a gate cannot do for itself: it proves the gate still detects a
 * planted violation (a gate that has quietly stopped detecting anything is worse than
 * no gate, because it is believed), and it pins the wiring, so the gate cannot be
 * silently dropped from the local chain or from CI.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  APP_SOURCE_ROOTS,
  PINNED_READ_PATHS,
  REVIEWED_EXEMPTIONS,
  buildFunctionIndex,
  discoverAppInvoked,
  findViolations,
  pinnedExemptionFailures,
  selfTestCases,
  wholeCorpusReasons,
} from "../scripts/check-read-path-cost.mjs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

describe("check-read-path-cost detects what it claims to detect", () => {
  const cases = selfTestCases() as Array<{ name: string; pass: boolean; detail: string }>;

  it("has not lost its self-test cases", () => {
    // A self-test that silently shrinks to zero cases reports success forever.
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(testCase.pass, testCase.detail).toBe(true);
    });
  }
});

describe("the rule the gate encodes", () => {
  const readPath = (body: string) =>
    buildFunctionIndex([
      {
        label: "t",
        sql: `create function public.read_thing(p_kind text) returns setof jsonb language sql stable as $$ ${body} $$;`,
      },
    ]).get("read_thing")![0];

  it("treats a hash of the whole corpus as whole-corpus work", () => {
    const reasons = wholeCorpusReasons(
      readPath(
        `select public.site_content_json_sha256(jsonb_agg(rr.record))::jsonb
         from public.site_content_release_records rr;`,
      ),
    ) as Array<{ rule: string }>;
    expect(reasons.map((reason) => reason.rule)).toContain("R2");
  });

  it("does NOT treat a constant-cost hash of a few scalars as whole-corpus work", () => {
    // Precision is what keeps this gate believed. A gate that fires on an O(1) hash
    // gets allowlisted into uselessness within a month.
    expect(
      wholeCorpusReasons(
        readPath(
          `select rr.record from public.site_content_release_records rr
           where rr.id = public.site_content_json_sha256(jsonb_build_object('kind', p_kind))::uuid;`,
        ),
      ),
    ).toEqual([]);
  });

  it("scopes the LIMIT test to the scan, so an unrelated LIMIT cannot silence it", () => {
    const reasons = wholeCorpusReasons(
      readPath(
        `select to_jsonb((select count(*) from public.site_content_release_records rr))
         from (select 1 limit 1) unrelated;`,
      ),
    ) as Array<{ rule: string }>;
    expect(reasons.map((reason) => reason.rule)).toContain("R3");
  });

  const rules = (body: string) => (wholeCorpusReasons(readPath(body)) as Array<{ rule: string }>).map((r) => r.rule);

  it.each([
    [
      "a count(*) of one row by primary key",
      `select count(*) from public.site_content_release_records rr
       where rr.id = p_kind::uuid;`,
    ],
    ["a max() of a bare scalar column", `select max(head_change_epoch) from public.site_content_public_records;`],
    [
      "a single-document detail read",
      `select jsonb_agg(rr.record) from public.site_content_release_records rr
       where rr.logical_id = p_kind;`,
    ],
    ["a count(*) narrowed by kind", `select count(*) from public.site_content_publications where kind = p_kind;`],
    [
      "the runbook's index-only count(*) against a stored expected count",
      `select r.expected_record_count = (
       select count(*) from public.site_content_release_records rr where rr.release_id = r.id)
       from public.site_content_releases r where r.id = p_kind::uuid;`,
    ],
    [
      "a bool_and() over one release's rows",
      `select bool_and(rr.public_visible)
       from public.site_content_release_records rr where rr.release_id = p_kind::uuid;`,
    ],
    [
      "a genuinely bounded scan",
      `select count(*) from (select 1 from public.site_content_release_records limit 50) t;`,
    ],
  ])("R3 does not fire on %s", (_name, body) => {
    // Precision in this direction is what keeps the gate believed, and it is what makes
    // the gate agree with docs/site-content-sync-runbook.md, which permits an index-only
    // count(*) against a stored expected count on a read path.
    expect(rules(body)).toEqual([]);
  });

  it.each([
    ["an unfiltered aggregate over the corpus", `select count(*) from public.site_content_release_records;`],
    ["limit 1000000", `select count(*) from (select 1 from public.site_content_release_records limit 1000000) t;`],
    [
      "limit all, a Postgres no-op",
      `select count(*) from (select 1 from public.site_content_release_records limit all) t;`,
    ],
    [
      "a caller-supplied limit",
      `select count(*) from (select 1 from public.site_content_release_records limit p_kind::int) t;`,
    ],
    [
      "a limit 1 in a subquery of the scanning query",
      `select count(*) from public.site_content_release_records rr
       cross join (select 1 limit 1) unrelated;`,
    ],
  ])("R3 still fires on %s", (_name, body) => {
    expect(rules(body)).toContain("R3");
  });

  it("parses a single-quoted function body, and does not run past its end", () => {
    const byName = buildFunctionIndex([
      {
        label: "t",
        sql: `create function public.quoted(p uuid) returns text language sql stable
                as 'select public.site_content_bootstrap_digest(p)';
              create function public.next_one(p uuid) returns text language sql stable as $$ select 'untouched' $$;`,
      },
    ]) as Map<string, Array<{ body: string }>>;
    expect(byName.get("quoted")![0].body).toContain("site_content_bootstrap_digest");
    expect(byName.get("next_one")![0].body).toContain("untouched");
  });

  it("follows a VIEW into the call graph, because a view is selected from, not called", () => {
    const sql = `
      create view public.corpus_integrity_v as
        select r.id, public.site_content_json_sha256(jsonb_agg(rr.record)) digest
        from public.site_content_releases r
        join public.site_content_release_records rr on rr.release_id = r.id
        group by r.id;
      create function public.read_thing(p_id uuid) returns jsonb language sql stable as $$
        select v.digest::jsonb from public.corpus_integrity_v v where v.id = p_id;
      $$;`;
    const byName = buildFunctionIndex([{ label: "t", sql }]);
    const appInvoked = discoverAppInvoked(byName, [{ file: "src/lib/x.ts", text: `"read_thing"` }]);
    const violations = findViolations({ byName, appInvoked, label: "t" }) as Array<{
      readPath: string;
      via: string | null;
    }>;
    expect(violations.some((v) => v.readPath === "read_thing" && v.via === "corpus_integrity_v")).toBe(true);
  });
});

describe("the gate cannot be disarmed in one line", () => {
  // S2: an exemption short-circuits findViolations() before any rule runs, and the pinned
  // anchor is satisfied by a function that merely exists. One entry naming the pinned read
  // path was confirmed to take the real pre-incident schema to zero violations.
  it("pins the exact reviewed exemption set, so any change is a deliberate diff", () => {
    expect([...REVIEWED_EXEMPTIONS.keys()].sort()).toEqual(["read_site_content_health"]);
  });

  it("pins the exact set of anchored read paths", () => {
    expect([...PINNED_READ_PATHS].sort()).toEqual(["read_site_content_public_records"]);
  });

  it("refuses a pinned read path that is also exempted", () => {
    const failures = pinnedExemptionFailures(
      ["read_site_content_public_records"],
      new Map([["read_site_content_public_records", { reviewed: "2026-09-16", reason: "disarm attempt" }]]),
    ) as string[];
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("turns the gate off");
  });

  it("holds for what actually ships", () => {
    expect(pinnedExemptionFailures()).toEqual([]);
  });

  it("scans the edge functions, which are callers too", () => {
    // read_site_content_sync_event_plan is invoked only from
    // supabase/functions/site-content-sync/index.ts; without this root it was uninvoked.
    expect(APP_SOURCE_ROOTS).toContain("supabase/functions");
  });

  it("follows the call graph, so wrapping the work in a helper does not hide it", () => {
    const sql = `
      create function public.deep(p_id uuid) returns text language sql stable as $$
        select public.site_content_json_sha256(jsonb_agg(rr.record))
        from public.site_content_release_records rr where rr.release_id = p_id;
      $$;
      create function public.middle(p_id uuid) returns text language sql stable as $$ select public.deep(p_id); $$;
      create function public.read_thing(p_id uuid) returns text language sql stable as $$ select public.middle(p_id); $$;
    `;
    const byName = buildFunctionIndex([{ label: "t", sql }]);
    const appInvoked = discoverAppInvoked(byName, [{ file: "src/lib/x.ts", text: `"read_thing"` }]);
    const violations = findViolations({ byName, appInvoked, label: "t" }) as Array<{
      readPath: string;
      via: string | null;
    }>;
    expect(violations.some((v) => v.readPath === "read_thing" && v.via === "deep")).toBe(true);
  });
});

describe("the gate stays wired", () => {
  it("is an npm script", () => {
    expect(packageJson.scripts["check:read-path-cost"]).toBe("node scripts/check-read-path-cost.mjs");
  });

  it("runs in the local verify:cheap chain", () => {
    expect(packageJson.scripts["verify:cheap:internal"]).toContain("npm run check:read-path-cost");
  });

  it("runs in the static-pr CI job for heavy scope", () => {
    // Same static_heavy condition the database guards use: supabase/** and src/** both
    // set it, and tests/ci-cache-safety.test.ts mirrors every such step into verify:pr-local.
    expect(workflow).toMatch(
      /name: Read-path cost contract\n\s+if: needs\.changes\.outputs\.static_heavy_changed == 'true'\n\s+run: npm run check:read-path-cost/,
    );
  });

  it("is in the verify:pr-local heavy plan", () => {
    expect(readFileSync("scripts/verify-pr-local.mjs", "utf8")).toContain('"check:read-path-cost"');
  });

  it("is documented where the repository registers its gates", () => {
    expect(readFileSync("docs/process-hardening.md", "utf8")).toContain("Read paths never re-verify the whole corpus");
  });
});
