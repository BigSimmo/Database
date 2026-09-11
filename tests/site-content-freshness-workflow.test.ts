import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = "tests/fixtures/site-content/release-evidence-current.json";

function runWithIdentitySets(logicalIds: string[], publishedLogicalIds: string[]): string {
  const directory = mkdtempSync(join(tmpdir(), "site-content-freshness-identity-"));
  const evidencePath = join(directory, "evidence.json");
  try {
    const evidence = JSON.parse(readFileSync(fixture, "utf8"));
    writeFileSync(evidencePath, `${JSON.stringify({ ...evidence, logicalIds, publishedLogicalIds })}\n`, "utf8");
    return execFileSync(
      "node",
      ["scripts/run-tsx.mjs", "scripts/check-site-content-freshness.ts", "--evidence", evidencePath],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

describe("site-content freshness workflow", () => {
  it("accepts the committed offline evidence and emits no private fixture identifiers", () => {
    const output = execFileSync(
      "node",
      ["scripts/run-tsx.mjs", "scripts/check-site-content-freshness.ts", "--evidence", fixture],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({ state: "current", operationStop: false });
    expect(output).not.toContain("synthetic:record");
  });

  it("fails before provider imports for unauthorized live mode and rejects unknown flags", () => {
    expect(() =>
      execFileSync("node", ["scripts/run-tsx.mjs", "scripts/check-site-content-freshness.ts", "--live"], {
        encoding: "utf8",
      }),
    ).toThrow(/SITE_CONTENT_LIVE_MODE_NOT_AUTHORIZED/);
    expect(() =>
      execFileSync(
        "node",
        ["scripts/run-tsx.mjs", "scripts/check-site-content-freshness.ts", "--evidence", fixture, "--unknown"],
        { encoding: "utf8" },
      ),
    ).toThrow(/SITE_CONTENT_FRESHNESS_ARGUMENTS_INVALID/);
  });

  it("rejects unique unequal identity arrays that collide under delimiter joining", () => {
    expect(() => runWithIdentitySets(["a", "b|c"], ["a|b", "c"])).toThrow(/SITE_CONTENT_OFFLINE_EVIDENCE_INVALID/);
  });

  it("rejects structurally unequal canonical logical-ID sets", () => {
    expect(() => runWithIdentitySets(["forms:a", "services:b"], ["forms:a", "services:c"])).toThrow(
      /SITE_CONTENT_OFFLINE_EVIDENCE_INVALID/,
    );
  });

  it("accepts canonical logical-ID sets independently of input order", () => {
    const output = runWithIdentitySets(["forms:a", "services:b"], ["services:b", "forms:a"]);
    expect(JSON.parse(output)).toMatchObject({ state: "current", operationStop: false });
  });

  it("wires the offline checks in the static-pr job without mutation or provider commands", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const start = workflow.indexOf("site_content_changed == 'true'");
    const block = workflow.slice(start, start + 900);
    expect(start).toBeGreaterThan(0);
    expect(block.indexOf("build-site-content-manifest.ts --check")).toBeLessThan(
      block.indexOf("check-site-content-freshness.ts --evidence"),
    );
    expect(block).not.toMatch(/--write|--live|supabase\s+(?:db|migration)|activate|rollback|deploy|OPENAI_API_KEY/);
  });
});
