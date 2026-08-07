import { describe, expect, it } from "vitest";
import {
  filesForPrUiShard,
  listProductionSpecFiles,
  prUiShardGroups,
  productionSpecFilePattern,
  validatePrUiShardGroups,
} from "../scripts/playwright-pr-shards.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";

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

  it("keeps the file pattern aligned with playwright.config.ts productionSpecPattern", () => {
    const config = readFileSync(path.resolve("playwright.config.ts"), "utf8");
    expect(config).toContain("const productionSpecPattern =");
    expect(config).toContain("phone-scroll(?:-[a-z0-9-]+)?");
    expect(productionSpecFilePattern.test("ui-phone-scroll-page-owned.spec.ts")).toBe(true);
    expect(productionSpecFilePattern.test("ui-tools-collapse.spec.ts")).toBe(false);
  });

  it("keeps every shard non-empty and returns files for CI runners", () => {
    for (const shard of [1, 2, 3]) {
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
});
