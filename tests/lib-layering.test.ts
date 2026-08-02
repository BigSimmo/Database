import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("library layering", () => {
  it("keeps src/lib independent from UI components", () => {
    const libRoot = path.resolve("src/lib");
    const reverseImports = sourceFiles(libRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /(?:from\s+|import\s*\()\s*["']@\/components\//.test(source) ? [path.relative(process.cwd(), file)] : [];
    });

    expect(reverseImports).toEqual([]);
  });
});
