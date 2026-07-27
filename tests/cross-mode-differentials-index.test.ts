import { readFileSync } from "node:fs";
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
      })),
      aliases: differentialSearchAliases(),
    };

    // JSON round-trip the live side so an undefined field (omitted by JSON) compares
    // equal to the committed index rather than tripping on present-vs-absent keys.
    expect(crossModeDifferentialCatalog()).toEqual(JSON.parse(JSON.stringify(live)));
  });

  it("only imports the precomputed index — no static, dynamic, or transitive path to the heavy snapshot", () => {
    // The value-equality test above stays green regardless of HOW the catalog is
    // produced, so it cannot catch a regression that reintroduces the ~1.2 MB
    // snapshot into the lazily-loaded cross-mode chunk. Guard the import graph at
    // its entry point with an allowlist: cross-mode-differentials.ts may import ONLY
    // the precomputed index and the (type-only, runtime-erased) catalog type.
    // Anything else fails — a direct `@/lib/differentials` re-import, a NEW helper
    // that transitively pulls it, or a dynamic `import()` / `require()` form — because
    // any such regression must add a new import specifier to THIS file.
    const source = readFileSync(
      fileURLToPath(new URL("../src/lib/cross-mode-differentials.ts", import.meta.url)),
      "utf8",
    );
    const allowed = new Set(["@/data/cross-mode-differentials-index.json", "@/lib/cross-mode-links"]);
    const specifiers = [
      /\bfrom\s*["']([^"']+)["']/g, // static: import … from "x"
      /\bimport\s*\(\s*["']([^"']+)["']/g, // dynamic: import("x")
      /\brequire\s*\(\s*["']([^"']+)["']/g, // cjs: require("x")
      /(?:^|\n)\s*import\s+["']([^"']+)["']/g, // side-effect: import "x"
    ].flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]));

    // Every import specifier must be in the allowlist — so a re-import of
    // `@/lib/differentials` (or a helper/dynamic form pulling the snapshot) surfaces
    // as a disallowed specifier and fails here. Comment mentions don't count: only
    // real `from`/`import()`/`require` specifiers are collected.
    expect(specifiers.filter((specifier) => !allowed.has(specifier))).toEqual([]);
    expect(specifiers).toContain("@/data/cross-mode-differentials-index.json");
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
