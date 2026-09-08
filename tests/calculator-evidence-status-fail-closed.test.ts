import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A calculator evidence source carries `status` as an unrestricted string. If an unrecognised
 * value read as `active`, `/sources` would present ambiguous or quarantined evidence with no
 * inactive or excluded warning — the failure this pair of guards exists to make impossible.
 *
 * Two independent guards, tested separately because they fail at different moments:
 *  - the reader falls closed to `inactive` for anything it does not recognise
 *  - `check:calculator-content` refuses the data outright, so a new status is noticed rather
 *    than silently demoting a source at every read
 */

const REPO_ROOT = join(__dirname, "..");
const PROVIDER = join(REPO_ROOT, "src/lib/sources/repository-providers.ts");
const CHECKER = join(REPO_ROOT, "scripts/check-calculator-content.mjs");
const EVIDENCE = join(REPO_ROOT, "data/calculators/evidence.json");

/**
 * The mapping is module-private and the module is `server-only`, so read the literal it is
 * declared from. That keeps the test honest: it fails if the table is edited, rather than
 * restating a copy that can drift.
 */
function lifecycleTable(): Record<string, string> {
  const src = readFileSync(PROVIDER, "utf8");
  const block = src.match(/const CALCULATOR_EVIDENCE_LIFECYCLE: Record<string, SourceLifecycleStatus> = \{([^}]*)\}/);
  expect(block, "CALCULATOR_EVIDENCE_LIFECYCLE must exist in repository-providers.ts").toBeTruthy();
  const table: Record<string, string> = {};
  for (const [, key, value] of block![1].matchAll(/(\w+):\s*"(\w+)"/g)) table[key] = value;
  return table;
}

describe("calculator evidence status is read fail-closed", () => {
  it("maps only the reviewed status to active", () => {
    const table = lifecycleTable();
    expect(table).toEqual({
      reviewed: "active",
      permission_review_required: "inactive",
      not_for_active_use: "excluded",
    });
    expect(
      Object.entries(table)
        .filter(([, v]) => v === "active")
        .map(([k]) => k),
    ).toEqual(["reviewed"]);
  });

  it("falls back to inactive rather than active, so an unknown status cannot present as current", () => {
    const src = readFileSync(PROVIDER, "utf8");
    const fn = src.match(/function calculatorEvidenceLifecycle\([^)]*\)[^{]*\{([^}]*)\}/);
    expect(fn, "calculatorEvidenceLifecycle must exist").toBeTruthy();
    // The behaviour under test: the default for an unrecognised key.
    expect(fn![1]).toContain('?? "inactive"');
    expect(fn![1]).not.toContain('?? "active"');
  });

  it("resolves a missing, misspelled and newly introduced status to inactive", () => {
    const table = lifecycleTable();
    const resolve = (status: unknown) => table[status as string] ?? "inactive";
    expect(resolve(undefined)).toBe("inactive");
    expect(resolve("")).toBe("inactive");
    expect(resolve("Reviewed")).toBe("inactive");
    expect(resolve("reviewd")).toBe("inactive");
    expect(resolve("provisionally_reviewed")).toBe("inactive");
    // Control: the one status that may be active still is.
    expect(resolve("reviewed")).toBe("active");
  });
});

describe("check:calculator-content refuses an unknown evidence status", () => {
  function runCheckerAgainst(mutate: (evidence: { sources: { status: string }[] }) => void) {
    const dir = mkdtempSync(join(tmpdir(), "calc-evidence-"));
    const evidence = JSON.parse(readFileSync(EVIDENCE, "utf8"));
    mutate(evidence);
    const copy = join(dir, "evidence.json");
    writeFileSync(copy, JSON.stringify(evidence, null, 2));
    // Run the real checker with the evidence file swapped, so this exercises the shipped
    // script rather than a restatement of its rule.
    const script = readFileSync(CHECKER, "utf8")
      // The script derives its root from its own location, so pin both the root and the one
      // input under test; every other input still comes from the real repository.
      .replace(
        'const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
        `const root = ${JSON.stringify(REPO_ROOT)};`,
      )
      .replace(
        'const evidencePath = resolve(root, "data/calculators/evidence.json");',
        `const evidencePath = ${JSON.stringify(copy)};`,
      );
    const scriptPath = join(dir, "check.mjs");
    writeFileSync(scriptPath, script);
    try {
      const out = execFileSync("node", [scriptPath], { cwd: REPO_ROOT, encoding: "utf8" });
      return { code: 0, out };
    } catch (error) {
      const e = error as { status: number; stdout?: string; stderr?: string };
      return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  }

  it("passes on the evidence file as committed", () => {
    const { code, out } = runCheckerAgainst(() => {});
    expect(out).toContain("CALCULATOR_CONTENT_PASS");
    expect(code).toBe(0);
  });

  it("fails on a misspelled status instead of letting the reader demote it silently", () => {
    const { code, out } = runCheckerAgainst((evidence) => {
      evidence.sources[0].status = "reviewd";
    });
    expect(code).not.toBe(0);
    expect(out).toContain('status "reviewd" is not one of');
  });

  it("fails on a newly introduced status, so adding one is a deliberate decision", () => {
    const { code, out } = runCheckerAgainst((evidence) => {
      evidence.sources[0].status = "provisionally_reviewed";
    });
    expect(code).not.toBe(0);
    expect(out).toContain("provisionally_reviewed");
  });

  it("fails on a missing status", () => {
    const { code, out } = runCheckerAgainst((evidence) => {
      delete (evidence.sources[0] as Partial<{ status: string }>).status;
    });
    expect(code).not.toBe(0);
    expect(out).toContain("is not one of");
  });
});
