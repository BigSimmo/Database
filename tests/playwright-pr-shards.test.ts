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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(30);
    }
  });

  it("excludes the fail-fast subset only when CI already proved it", () => {
    expect(playwrightArgsForPrUiShard(1)).toContain("@quarantine|@mockup");
    const regressionArgs = playwrightArgsForPrUiShard(1, { excludeCritical: true });
    expect(regressionArgs).toContain("@critical|@quarantine|@mockup");
    expect(regressionArgs).not.toContain("@quarantine|@mockup");
  });
});
