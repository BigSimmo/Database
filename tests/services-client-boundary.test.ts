import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the PR #890 fix: the ~915 KB services snapshot reaches
// the client the moment any client module value-imports "@/lib/services"
// (~100 KB gzip in that route chunk). The enforced bundle budget alone cannot
// catch a re-introduction — its 10% tolerance sits above the pre-fix total —
// so this boundary is asserted at the source level. Type-only imports are
// erased at compile time and stay allowed.
const CLIENT_ROOTS = ["src/components", "src/app"];
const VALUE_IMPORT_PATTERN = /^import\s+(?!type\b)[^;]*?from\s+["']@\/lib\/services["']/m;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/m.test(source.slice(0, 400));
}

describe("services snapshot client boundary", () => {
  it("keeps @/lib/services value-imports out of client modules", () => {
    const offenders: string[] = [];

    for (const root of CLIENT_ROOTS) {
      for (const filePath of collectSourceFiles(join(process.cwd(), root))) {
        const source = readFileSync(filePath, "utf8");
        if (isClientModule(source) && VALUE_IMPORT_PATTERN.test(source)) {
          offenders.push(relative(process.cwd(), filePath));
        }
      }
    }

    expect(
      offenders,
      "Client modules must not value-import @/lib/services: it compiles the full services snapshot " +
        "into their chunk. Compute what you need server-side and pass it as a prop " +
        "(see src/app/services/page.tsx), or use `import type` for types only.",
    ).toEqual([]);
  });
});
