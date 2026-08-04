import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * PR 3 — the disabled encoding is the `controlBase` / `controlDisabled` recipe,
 * not opacity. The SPEC §6 set is these three design-system files.
 */

const FILES = [
  "../src/components/ui-primitives.tsx",
  "../src/components/ui/tabs.tsx",
  "../src/components/ui/pagination.tsx",
] as const;

describe("disabled encoding contracts", () => {
  it("has zero disabled:opacity* recipes in the design-system control files", () => {
    const hits: string[] = [];
    for (const rel of FILES) {
      const source = readFileSync(new URL(rel, import.meta.url), "utf8");
      for (const match of source.matchAll(/disabled:opacity-\d+/g)) {
        hits.push(`${rel}: ${match[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
