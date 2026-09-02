import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PARITY_CATEGORIES,
  compareChainAgainstMirror,
  formatReport,
  parityEntryProblems,
  comparableSnapshot,
  type ParityAllowlistEntry,
} from "../scripts/check-chain-mirror-parity";

/**
 * #QCNE6N. `supabase migration up --local` proves the migration chain APPLIES;
 * the drift manifest's sha256 check proves the mirror is not stale. Neither
 * compares what the chain BUILDS against what supabase/schema.sql DESCRIBES, so
 * a diverging function body passed every pre-merge gate on 2026-09-01.
 *
 * These tests cover the half that can be proven offline: the comparison itself,
 * the allowlist's fail-closed shape, and the CI wiring's internal consistency.
 * The CI steps themselves cannot run here (no Docker daemon, no Supabase CLI,
 * and the local PostgreSQL has no `vector` extension) and `db-reset-verify` is
 * skipped on draft PRs, so their first real execution is on an undrafted PR.
 */

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const EMPTY_SNAPSHOT = {
  captured_at: "2026-09-02T00:00:00Z",
  extensions: [],
  tables: [],
  views: [],
  functions: [],
  indexes: [],
  policies: [],
  constraints: [],
  triggers: [],
  storage_buckets: [],
};

const withFunction = (defHash: string) => ({
  ...EMPTY_SNAPSHOT,
  functions: [{ signature: "public.correct_clinical_query_terms(text,real)", def_hash: defHash, acl: [] }],
});

describe("chain vs schema.sql parity comparison", () => {
  it("reports nothing when both builds agree", () => {
    const result = compareChainAgainstMirror(withFunction("aaa"), withFunction("aaa"), []);
    expect(result.findings).toEqual([]);
  });

  it("reports the 2026-09-01 failure class: same function, different body", () => {
    const result = compareChainAgainstMirror(withFunction("aaa"), withFunction("bbb"), []);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      category: "functions",
      kind: "mismatch",
      key: "public.correct_clinical_query_terms(text,real)",
    });
  });

  it("reports an object schema.sql describes that the chain never builds", () => {
    const result = compareChainAgainstMirror(withFunction("aaa"), EMPTY_SNAPSHOT, []);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].kind).toBe("missing_live");
  });

  it("reports an object only the chain builds", () => {
    const result = compareChainAgainstMirror(EMPTY_SNAPSHOT, withFunction("aaa"), []);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].kind).toBe("unexpected_live");
  });

  it("compares policies and index shapes, not just functions", () => {
    const mirror = {
      ...EMPTY_SNAPSHOT,
      policies: [
        {
          schema: "public",
          table: "documents",
          name: "owner_read",
          permissive: "PERMISSIVE",
          roles: ["authenticated"],
          cmd: "SELECT",
          qual: "(owner_id = auth.uid())",
          with_check: null,
        },
      ],
      indexes: [{ name: "documents_owner_id_idx", table: "documents", def_hash: "idx-a" }],
    };
    const chain = {
      ...mirror,
      policies: [{ ...mirror.policies[0], qual: "(true)" }],
      indexes: [{ ...mirror.indexes[0], def_hash: "idx-b" }],
    };
    const kinds = compareChainAgainstMirror(mirror, chain, []).findings.map((f) => `${f.category}:${f.kind}`);
    expect(kinds).toContain("policies:mismatch");
    expect(kinds).toContain("indexes:mismatch");
  });

  it("strips the migration-history probe from both sides rather than allowlisting it", () => {
    const chain = {
      ...withFunction("aaa"),
      migration_history: [{ version: "20260101000000", name: "x", signal: "null" }],
      migration_history_probe: "ok",
    };
    expect(compareChainAgainstMirror(withFunction("aaa"), chain, []).findings).toEqual([]);
    expect(comparableSnapshot(chain)).not.toHaveProperty("migration_history");
    expect(comparableSnapshot(chain)).not.toHaveProperty("migration_history_probe");
  });
});

describe("chain-mirror allowlist is fail-closed", () => {
  const valid: ParityAllowlistEntry = {
    category: "functions",
    kind: "mismatch",
    key: "public.correct_clinical_query_terms(text,real)",
    reason: "reviewed divergence with an explanation long enough to be worth reading",
  };

  it("consumes a finding only for a structurally valid entry", () => {
    const allowed = compareChainAgainstMirror(withFunction("aaa"), withFunction("bbb"), [valid]);
    expect(allowed.findings).toEqual([]);
    expect(allowed.allowed).toHaveLength(1);
  });

  it("never lets a malformed entry silence a divergence", () => {
    for (const broken of [
      { ...valid, reason: "too short" },
      { ...valid, category: "not_a_category" },
      { ...valid, kind: "no_statements" as ParityAllowlistEntry["kind"] },
      { ...valid, key: "" },
    ]) {
      expect(parityEntryProblems(broken).length, JSON.stringify(broken)).toBeGreaterThan(0);
      const result = compareChainAgainstMirror(withFunction("aaa"), withFunction("bbb"), [broken]);
      expect(result.findings, JSON.stringify(broken)).toHaveLength(1);
      expect(result.staleEntries, JSON.stringify(broken)).toHaveLength(1);
    }
  });

  it("reports an entry that matches nothing as stale", () => {
    const result = compareChainAgainstMirror(withFunction("aaa"), withFunction("aaa"), [valid]);
    expect(result.findings).toEqual([]);
    expect(result.staleEntries).toHaveLength(1);
  });

  it("keeps the committed allowlist valid, and separate from the live drift allowlist", () => {
    const file = JSON.parse(read("supabase/chain-mirror-allowlist.json")) as {
      entries: ParityAllowlistEntry[];
    };
    expect(Array.isArray(file.entries)).toBe(true);
    for (const entry of file.entries) {
      expect(parityEntryProblems(entry), `invalid entry ${entry.category}/${entry.kind}/${entry.key}`).toEqual([]);
    }
    const keys = file.entries.map((entry) => `${entry.category}|${entry.kind}|${entry.key}`);
    expect(new Set(keys).size, "duplicate allowlist entries").toBe(keys.length);

    // The two allowlists must stay separate: an entry in the live one blinds the
    // weekly live-drift alarm, a different and far more consequential thing to go
    // blind about. Assert SEPARATION, not a policy on the live file's contents —
    // check:drift legitimately supports object-category entries there, and
    // constraining that from this suite would fail a future live entry with a
    // confusing message from an unrelated gate.
    expect(read("scripts/check-drift.ts")).not.toContain("chain-mirror-allowlist");
    expect(read("scripts/check-chain-mirror-parity.ts")).not.toContain("drift-allowlist.json");
  });

  it("names every snapshot category the comparison covers", () => {
    expect([...PARITY_CATEGORIES].sort()).toEqual(
      [
        "constraints",
        "extensions",
        "functions",
        "indexes",
        "policies",
        "storage_buckets",
        "tables",
        "triggers",
        "views",
      ].sort(),
    );
  });
});

describe("the report says which side is which", () => {
  it("explains the direction of every divergence and how to clear it", () => {
    const report = formatReport(compareChainAgainstMirror(withFunction("aaa"), withFunction("bbb"), []), false);
    expect(report).toContain("both build it, with different definitions");
    expect(report).toContain("REPORT-ONLY");
    expect(report).toContain("chain-mirror-allowlist.json");
    expect(formatReport(compareChainAgainstMirror(withFunction("aaa"), EMPTY_SNAPSHOT, []), false)).toContain(
      "schema.sql describes it, the migration chain never builds it",
    );
    expect(formatReport(compareChainAgainstMirror(EMPTY_SNAPSHOT, withFunction("aaa"), []), false)).toContain(
      "the migration chain builds it, schema.sql does not describe it",
    );
  });

  it("drops the live gate's history-probe advice, which is false and harmful here", () => {
    // compareDriftSnapshots emits "migration 20260818090000 is not deployed; the
    // schema_drift_snapshot() function mismatch is that pending deploy, not a
    // body regression" whenever a snapshot has no history probe. True for the
    // live gate. Here the probe IS applied and this script stripped it — and the
    // sentence coaches the reader to dismiss exactly the class of finding this
    // gate exists to surface.
    const chain = { ...withFunction("aaa"), migration_history: [], migration_history_probe: "ok" };
    const result = compareChainAgainstMirror(withFunction("aaa"), chain, []);
    for (const info of result.infos) {
      expect(info).not.toMatch(/migration-history probe not present/i);
      expect(info).not.toMatch(/not a body regression/i);
    }
    expect(formatReport(result, false)).not.toMatch(/not a body regression/i);
  });

  it("says so plainly when the two builds agree", () => {
    expect(formatReport(compareChainAgainstMirror(withFunction("aaa"), withFunction("aaa"), []), true)).toContain(
      "No divergence between the migration chain and supabase/schema.sql.",
    );
  });
});

describe("CI wiring for the parity gate", () => {
  const workflow = read(".github/workflows/ci.yml");

  it("runs the comparison inside the Migration replay job", () => {
    expect(workflow).toContain("- name: Capture the migration chain's schema snapshot");
    expect(workflow).toContain("- name: Compare the migration chain against supabase/schema.sql");
    expect(workflow).toContain("npm run check:chain-mirror-parity --");
  });

  it("captures the chain snapshot only after the chain has been replayed", () => {
    const replay = workflow.indexOf("- name: Verify Migration Replay");
    const capture = workflow.indexOf("- name: Capture the migration chain's schema snapshot");
    const compare = workflow.indexOf("- name: Compare the migration chain against supabase/schema.sql");
    expect(replay).toBeGreaterThan(-1);
    expect(capture).toBeGreaterThan(replay);
    expect(compare).toBeGreaterThan(capture);
  });

  it("takes the mirror side from the manifest regenerated in the same job", () => {
    const regenerate = workflow.indexOf("- name: Regenerate and verify drift manifest freshness");
    const compare = workflow.indexOf("- name: Compare the migration chain against supabase/schema.sql");
    expect(compare).toBeGreaterThan(regenerate);
    expect(workflow).toContain("--mirror-manifest supabase/drift-manifest.json");
  });

  it("ties report-only mode to the failure tolerance, so flipping one forces the other", () => {
    const parityBlock = workflow.slice(
      workflow.indexOf("- name: Capture the migration chain's schema snapshot"),
      workflow.indexOf("- name: Upload regenerated drift manifest"),
    );
    const strict = parityBlock.includes("--strict");
    const tolerated = parityBlock.split("continue-on-error: true").length - 1;

    if (strict) {
      // Blocking mode: the steps must be able to fail the job, or "strict" is a lie.
      expect(tolerated, "a --strict parity gate must not carry continue-on-error").toBe(0);
    } else {
      // Report-only mode: shipping an unproven gate must not break Migration
      // replay for every other PR, so both steps stay tolerant.
      expect(tolerated, "report-only parity steps must not be able to fail the job").toBe(2);
    }
  });

  it("says out loud when either parity step produced no evidence", () => {
    // Both parity steps carry continue-on-error, so a crashing compare step is a
    // grey mark nobody reads. Without covering its outcome too, "found thirteen
    // divergences" and "has been crashing for a month" look identical.
    expect(workflow).toContain("- name: Report a chain/mirror parity step that produced no evidence");
    expect(workflow).toContain(
      "steps.chain-snapshot.outcome != 'success' || steps.chain-mirror-parity.outcome != 'success'",
    );
    expect(workflow).toContain("chain/mirror parity produced no evidence");
  });

  it("does not build the container name through a pipeline that set -o pipefail can kill", () => {
    // `docker ps | grep | head` under `set -o pipefail` fails the step on a
    // SIGPIPE from head, and grep exiting 1 on no match aborts before the
    // explicit `test -n` can explain what happened.
    const parityBlock = workflow.slice(
      workflow.indexOf("- name: Capture the migration chain's schema snapshot"),
      workflow.indexOf("- name: Upload regenerated drift manifest"),
    );
    expect(parityBlock).toContain("--filter 'name=^supabase_db_'");
    expect(parityBlock).not.toContain("| grep '^supabase_db_'");
  });

  it("report-only mode has an expiry, so the follow-up cannot be forgotten", () => {
    // The strict/tolerance tie above keeps the two consistent but is satisfied
    // forever by a gate that never becomes strict. The only forcing function for
    // ending report-only is otherwise a code comment. Once the first real CI run
    // has printed the divergence set there is nothing left to wait for, so this
    // goes red if the phase is still open past the deadline.
    const REPORT_ONLY_DEADLINE = new Date("2026-12-01T00:00:00Z");
    const parityBlock = workflow.slice(
      workflow.indexOf("- name: Capture the migration chain's schema snapshot"),
      workflow.indexOf("- name: Upload regenerated drift manifest"),
    );
    const stillReportOnly = !parityBlock.includes("--strict");
    if (!stillReportOnly) return;

    expect(
      Date.now(),
      "chain/mirror parity is still report-only past its deadline. The first CI run has long since printed the " +
        "divergence set: commit it to supabase/chain-mirror-allowlist.json with a reason each, add --strict, and " +
        "remove the continue-on-error lines in the same change. Move the deadline only with a reason in the PR body.",
    ).toBeLessThan(REPORT_ONLY_DEADLINE.getTime());
  });

  it("routes a change to the parity script into the job that runs it", () => {
    expect(read("scripts/ci-change-scope.mjs")).toContain("check-chain-mirror-parity");
  });
});
