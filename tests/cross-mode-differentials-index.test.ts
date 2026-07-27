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

  it("carries the full catalogue and drops bare-number aliases", () => {
    const catalog = crossModeDifferentialCatalog();
    expect(catalog.diagnoses.length).toBeGreaterThan(0);
    expect(catalog.presentations.length).toBeGreaterThan(0);
    const aliasValues = Object.values(catalog.aliases).flat();
    expect(aliasValues.length).toBeGreaterThan(0);
    expect(aliasValues.every((alias) => !/^\d+(\.\d+)?$/.test(alias.trim()))).toBe(true);
  });
});
