import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { crossModeDifferentialCatalog } from "@/lib/cross-mode-differentials";
import { differentialPresentations, differentialRecords, differentialSearchAliases } from "@/lib/differentials";

// cross-mode-differentials.ts now returns a precomputed index
// (src/data/cross-mode-differentials-index.json) instead of projecting the full
// ~1.2 MB snapshot at runtime, to keep the lazy cross-mode chunk small. This locks
// the index to the live projection so the two can never silently drift — it catches
// both snapshot-content changes and any divergence in the projection / alias-filter
// logic. `npm run check:cross-mode-index` is the fast offline gate; this is the
// behavioural guarantee.
describe("cross-mode differentials precomputed index", () => {
  it("matches the live projection over the full differentials snapshot", () => {
    const live = {
      diagnoses: differentialRecords.map((record) => ({
        slug: record.slug,
        title: record.title,
        clinicalHinge: record.clinicalHinge,
      })),
      presentations: differentialPresentations().map((presentation) => ({
        id: presentation.id,
        title: presentation.title,
        subtitle: presentation.subtitle,
        titleAliases: presentation.titleAliases,
      })),
      aliases: differentialSearchAliases(),
    };

    // JSON round-trip the live side so an undefined field (omitted by JSON) compares
    // equal to the committed index rather than tripping on present-vs-absent keys.
    expect(crossModeDifferentialCatalog()).toEqual(JSON.parse(JSON.stringify(live)));
  });

  it("resolved lazy-chunk graph reaches the trimmed index and never the heavy snapshot", () => {
    // The value-equality test above stays green regardless of HOW the catalog is
    // produced. Walk the resolved runtime import graph from the lazy entry so a
    // helper (or a value-import of an allowlisted type module) cannot reintroduce
    // @/lib/differentials / the snapshot while a surface-level regex stays green.
    const srcRoot = join(process.cwd(), "src");
    const entryPath = resolve(process.cwd(), "src/lib/cross-mode-differentials.ts");
    const indexPath = resolve(process.cwd(), "src/data/cross-mode-differentials-index.json");
    const forbiddenPaths = new Set(
      [
        "lib/differentials.ts",
        "lib/differentials.tsx",
        "lib/differentials/index.ts",
        "lib/differentials/index.tsx",
        "lib/differential-fixtures.ts",
        "lib/differential-fixtures.tsx",
      ].map((candidate) => join(srcRoot, candidate)),
    );
    const snapshotSuffix = join("data", "differentials-snapshot.json");

    const sideEffectImport = /^import\s+["']([^"']+)["']/gm;
    const dynamicImport = /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*["']([^"']+)["'][\s\S]*?\)/g;
    const fromStatement = /^(import|export)\s+([\s\S]+?)\s+from\s+["']([^"']+)["']/gm;

    const hasRuntimeBindings = (kind: string, clause: string): boolean => {
      const trimmed = clause.trim();
      if (/^type\b/.test(trimmed)) return false;
      const named = trimmed.match(/^\{([\s\S]*)\}$/);
      if (named) {
        return named[1]
          .split(",")
          .map((specifier) => specifier.trim())
          .filter(Boolean)
          .some((specifier) => !/^type\b/.test(specifier));
      }
      return kind === "import" || kind === "export";
    };

    const resolveImport = (specifier: string, fromFile: string): string | null => {
      let base: string;
      if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
      else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
      else return null;

      for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.json`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      }
      return null;
    };

    const runtimeImports = (filePath: string): string[] => {
      if (filePath.endsWith(".json")) return [];
      const source = readFileSync(filePath, "utf8");
      const imports: string[] = [];
      const record = (specifier: string) => {
        const resolved = resolveImport(specifier, filePath);
        if (resolved) imports.push(resolved);
      };
      for (const match of source.matchAll(sideEffectImport)) record(match[1]);
      for (const match of source.matchAll(dynamicImport)) record(match[1]);
      for (const match of source.matchAll(fromStatement)) {
        if (hasRuntimeBindings(match[1], match[2])) record(match[3]);
      }
      return imports;
    };

    const chainFor = (cameFrom: Map<string, string>, hit: string): string => {
      const chain: string[] = [];
      for (let step: string | undefined = hit; step; step = cameFrom.get(step) || undefined) {
        chain.unshift(relative(process.cwd(), step));
      }
      return chain.join(" -> ");
    };

    const isForbidden = (path: string): boolean => forbiddenPaths.has(path) || path.endsWith(snapshotSuffix);

    const cameFrom = new Map<string, string>([[entryPath, ""]]);
    const queue = [entryPath];
    const seen = new Set<string>([entryPath]);
    const offenders: string[] = [];
    let reachedIndex = false;

    while (queue.length > 0) {
      const currentPath = queue.shift() as string;
      if (currentPath === indexPath) reachedIndex = true;
      if (isForbidden(currentPath)) {
        offenders.push(chainFor(cameFrom, currentPath));
        continue;
      }
      for (const next of runtimeImports(currentPath)) {
        if (seen.has(next)) continue;
        seen.add(next);
        cameFrom.set(next, currentPath);
        queue.push(next);
      }
    }

    expect(
      offenders,
      "Lazy cross-mode chunk must not resolve to @/lib/differentials or differentials-snapshot. " +
        "Keep the catalog on the precomputed JSON index (or a helper that only imports that index).",
    ).toEqual([]);
    expect(reachedIndex, "lazy chunk must import the trimmed cross-mode index JSON").toBe(true);

    // Entry-file allowlist remains as a fast fail for accidental direct imports
    // (including type-only neighbors that should stay type-only).
    const entrySource = readFileSync(
      fileURLToPath(new URL("../src/lib/cross-mode-differentials.ts", import.meta.url)),
      "utf8",
    );
    const entrySpecifiers = [
      /\bfrom\s*["']([^"']+)["']/g,
      /\bimport\s*\(\s*["']([^"']+)["']/g,
      /\brequire\s*\(\s*["']([^"']+)["']/g,
      /(?:^|\n)\s*import\s+["']([^"']+)["']/g,
    ].flatMap((pattern) => [...entrySource.matchAll(pattern)].map((match) => match[1]));
    const allowedEntry = new Set(["@/data/cross-mode-differentials-index.json", "@/lib/cross-mode-links"]);
    expect(entrySpecifiers.filter((specifier) => !allowedEntry.has(specifier))).toEqual([]);
  });

  it("carries the full catalogue and drops bare-number aliases", () => {
    const catalog = crossModeDifferentialCatalog();
    expect(catalog.diagnoses.length).toBeGreaterThan(0);
    expect(catalog.presentations.length).toBeGreaterThan(0);
    const aliasValues = Object.values(catalog.aliases).flat();
    expect(aliasValues.length).toBeGreaterThan(0);
    expect(aliasValues.every((alias) => !/^\d+(\.\d+)?$/.test(alias.trim()))).toBe(true);
  });
});
