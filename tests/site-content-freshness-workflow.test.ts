import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = "tests/fixtures/site-content/release-evidence-current.json";

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
