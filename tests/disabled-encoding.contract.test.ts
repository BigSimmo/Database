import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { listPrimitiveRecipeSourcePaths } from "../scripts/design-system-contract-utils.mjs";

/**
 * PR 3 — the disabled encoding is the `controlBase` / `controlDisabled` recipe,
 * not opacity. The SPEC §6 set is the primitive recipes (barrel + modules)
 * plus these two control files.
 */

const FILES = [...listPrimitiveRecipeSourcePaths(), "src/components/ui/tabs.tsx", "src/components/ui/pagination.tsx"];

describe("disabled encoding contracts", () => {
  it("has zero disabled:opacity* recipes in the design-system control files", () => {
    const hits: string[] = [];
    let sawControlDisabled = false;
    for (const rel of FILES) {
      const source = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
      if (source.includes("export const controlDisabled")) sawControlDisabled = true;
      for (const match of source.matchAll(/disabled:opacity-\d+/g)) {
        hits.push(`${rel}: ${match[0]}`);
      }
    }
    expect(sawControlDisabled, "controlDisabled must still be scanned after the barrel split").toBe(true);
    expect(hits).toEqual([]);
  });
});
