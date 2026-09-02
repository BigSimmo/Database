import { describe, expect, it } from "vitest";
import {
  estimatedPrUiShardSeconds,
  filesForPrUiShard,
  listProductionSpecFiles,
  playwrightArgsForPrUiShard,
  prUiShardGroups,
  productionSpecFilePattern,
  validatePrUiShardGroups,
} from "../scripts/playwright-pr-shards.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function configPattern(configSource: string, name: string): RegExp {
  const match = new RegExp(`const ${name} =\\s*/([\\s\\S]*?)/;`).exec(configSource);
  if (!match?.[1]) throw new Error(`playwright.config.ts is missing \`const ${name} = /.../;\``);
  return new RegExp(match[1]);
}

function testMatchFromConfig(configSource: string): RegExp {
  const match = /testMatch:\s*\/(.*)\/,/.exec(configSource);
  if (!match?.[1]) throw new Error("playwright.config.ts is missing the top-level `testMatch: /.../,`");
  return new RegExp(match[1]);
}

function productionSpecPatternFromConfig(configSource: string): RegExp {
  const match = /const productionSpecPattern\s*=\s*\/([\s\S]*?)\/;/.exec(configSource);
  if (!match?.[1]) {
    throw new Error("playwright.config.ts is missing `const productionSpecPattern = /.../;`");
  }
  return new RegExp(`^${match[1].replace(/^\.\*/, "")}$`);
}

describe("playwright PR UI shard groups", () => {
  it("covers every on-disk production spec exactly once", () => {
    const result = validatePrUiShardGroups();
    expect(result.missing, `orphaned production specs: ${result.missing.join(", ")}`).toEqual([]);
    expect(result.extra, `unknown group entries: ${result.extra.join(", ")}`).toEqual([]);
    expect(result.duplicates, `duplicated specs: ${result.duplicates.join(", ")}`).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.shardCount).toBe(3);
    expect(result.onDisk.length).toBeGreaterThan(10);
  });

  it("keeps the shard matcher aligned with playwright.config.ts productionSpecPattern (#159)", () => {
    const config = readFileSync(path.resolve("playwright.config.ts"), "utf8");
    const fromConfig = productionSpecPatternFromConfig(config);
    const basenames = readdirSync(path.resolve("tests")).filter((file) => file.endsWith(".spec.ts"));
    expect(basenames.filter((file) => productionSpecFilePattern.test(file)).sort()).toEqual(
      basenames.filter((file) => fromConfig.test(file)).sort(),
    );
    expect(productionSpecFilePattern.test("dsm-ui-smoke.spec.ts")).toBe(true);
    expect(productionSpecFilePattern.test("ui-document-canvas.spec.ts")).toBe(true);
    expect(productionSpecFilePattern.test("ui-tools-collapse.spec.ts")).toBe(false);
  });

  /**
   * The 320px low-confidence AccessibleTable journey closed /issues #237 on 2026-08-16 and
   * was deleted by a merge commit one day later; no non-merge commit ever removed it, and
   * check:diff-integrity measures PR diffs, not merges (audit M31). It is the only browser
   * proof that "Not recorded" and the low-confidence warning stay legible in a clinical
   * table at 320px. Pin the spec, its project routing and the fixture route it needs.
   */
  it("collects the 320px AccessibleTable mockup journey in the advisory mockup project (M31)", () => {
    const config = readFileSync(path.resolve("playwright.config.ts"), "utf8");
    const spec = "tests/ui-accessible-table-mockup.spec.ts";
    expect(existsSync(path.resolve(spec)), `${spec} is missing`).toBe(true);
    const source = readFileSync(path.resolve(spec), "utf8");
    expect(source).toContain("@mockup");
    expect(source).toContain('"/mockups/accessible-table-browser-fixture"');
    expect(source).toContain("setViewportSize({ width: 320");
    expect(
      existsSync(path.resolve("src/app/mockups/accessible-table-browser-fixture/page.tsx")),
      "the fixture route the journey navigates to is gone",
    ).toBe(true);
    expect(testMatchFromConfig(config).test(spec), `${spec} is not collected by testMatch`).toBe(true);
    expect(configPattern(config, "mockupSpecPattern").test(spec), `${spec} is not in chromium-mockups`).toBe(true);
    expect(configPattern(config, "productionSpecPattern").test(spec), `${spec} leaked into production`).toBe(false);
    expect(productionSpecFilePattern.test(path.basename(spec))).toBe(false);
  });

  it("keeps every shard non-empty and returns files for CI runners", () => {
    for (const shard of [1, 2, 3] as const) {
      const files = filesForPrUiShard(shard);
      expect(files.length).toBeGreaterThan(0);
      expect(prUiShardGroups[shard]).toEqual(files);
    }
  });

  it("lists only production basename matches under tests/", () => {
    const files = listProductionSpecFiles();
    expect(files.every((file) => file.startsWith("tests/") && file.endsWith(".spec.ts"))).toBe(true);
    expect(files).not.toContain("tests/ui-tools-collapse.spec.ts");
  });

  it("keeps the measured full and post-critical groups duration-balanced", () => {
    for (const excludeCritical of [false, true]) {
      const totals = Object.values(estimatedPrUiShardSeconds({ excludeCritical }));
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(excludeCritical ? 10 : 30);
    }
  });

  it("excludes the critical subset only when the companion required job covers it", () => {
    expect(playwrightArgsForPrUiShard(1)).toContain("@quarantine|@mockup");
    const regressionArgs = playwrightArgsForPrUiShard(1, { excludeCritical: true });
    expect(regressionArgs).toContain("@critical|@quarantine|@mockup");
    expect(regressionArgs).not.toContain("@quarantine|@mockup");
  });
});
