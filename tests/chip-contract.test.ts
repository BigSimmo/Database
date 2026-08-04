import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sourceRoot = new URL("../src/", import.meta.url);

describe("Chip call-site contract", () => {
  it("keeps className layout-only instead of overriding appearance or size", () => {
    const violations: string[] = [];
    for (const relativePath of globSync("**/*.{ts,tsx}", { cwd: sourceRoot })) {
      if (relativePath === "components/ui/chip.tsx") continue;
      const source = readFileSync(new URL(relativePath, sourceRoot), "utf8");
      for (const match of source.matchAll(/<Chip\b[^>]*\bclassName=["']([^"']+)["'][^>]*>/g)) {
        const forbidden = match[1]
          .split(/\s+/)
          .filter((token) =>
            /(?:^|:)(?:bg-|border(?:-|$)|font-|h-|min-h-|max-h-|p[xy]?-(?:\d|\[)|rounded-|text-(?:2?xs|sm|base|lg|xl|\[color))/.test(
              token,
            ),
          );
        if (forbidden.length) violations.push(`${relativePath}: ${forbidden.join(" ")}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("uses named metadata density recipes instead of size overrides", () => {
    const violations: string[] = [];
    for (const relativePath of globSync("**/*.{ts,tsx}", { cwd: sourceRoot })) {
      const source = readFileSync(new URL(relativePath, sourceRoot), "utf8");
      for (const match of source.matchAll(/cn\(metadataPill,\s*["']([^"']+)["']/g)) {
        const forbidden = match[1]
          .split(/\s+/)
          .filter((token) => /(?:^|:)(?:h-|min-h-|max-h-|p[xy]?-(?:\d|\[)|text-(?:2?xs|sm|base|lg|xl))/.test(token));
        if (forbidden.length) violations.push(`${relativePath}: ${forbidden.join(" ")}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
