import { describe, expect, it } from "vitest";

import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import {
  deriveSourceCatalogueFacets,
  filterAndSortSourceCatalogue,
  parseSourceCatalogueFilters,
  projectSourceCatalogueForClient,
} from "@/lib/sources/catalogue-view";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";
import { sourceAttentionFlags, sourceProvenanceNotes } from "@/lib/sources/source-status-presentation";

/**
 * The source catalogue page serialises every entry into the HTML so the browser
 * can filter and sort without a round trip. Two rating fields were riding along
 * that nothing renders: `weights` is the `SOURCE_RATING_WEIGHTS` constant,
 * identical on every entry, and `reasons` restates `dimensions` as prose.
 *
 * `projectSourceCatalogueForClient` drops exactly those two and nothing else.
 * These tests pin both halves of that claim, because the failure mode is silent:
 * a dropped field the page does display would simply render blank.
 */

const ENTRIES = canonicalizeSourceReferences(repositorySourceReferences());

describe("client catalogue projection", () => {
  it("has a real catalogue to project", () => {
    expect(ENTRIES.length).toBeGreaterThan(100);
  });

  it("drops the two unrendered rating fields and keeps the rest of the rating", () => {
    const [projected] = projectSourceCatalogueForClient(ENTRIES);
    const [original] = ENTRIES;

    expect(projected.rating).not.toHaveProperty("weights");
    expect(projected.rating).not.toHaveProperty("reasons");
    expect(projected.rating.band).toBe(original.rating.band);
    expect(projected.rating.score).toBe(original.rating.score);
    expect(projected.rating.dimensions).toEqual(original.rating.dimensions);
  });

  it("changes nothing else on any entry", () => {
    const projected = projectSourceCatalogueForClient(ENTRIES);
    expect(projected).toHaveLength(ENTRIES.length);

    const withoutRating = (entry: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "rating"));

    for (const [index, entry] of ENTRIES.entries()) {
      expect(withoutRating(projected[index]), `entry ${entry.id}`).toEqual(withoutRating(entry));
    }
  });

  it("leaves the source record itself untouched", () => {
    const before = JSON.stringify(ENTRIES);
    projectSourceCatalogueForClient(ENTRIES);
    expect(JSON.stringify(ENTRIES)).toEqual(before);
    expect(ENTRIES[0].rating).toHaveProperty("weights");
    expect(ENTRIES[0].rating).toHaveProperty("reasons");
  });

  it("filters, sorts and derives facets identically to the full records", () => {
    const projected = projectSourceCatalogueForClient(ENTRIES);
    const queries = [
      "",
      "?sort=title",
      "?sort=currency",
      "?band=A",
      "?band=A&band=B",
      "?jurisdiction=wa",
      "?q=health",
      "?lifecycle=active",
      "?validation=unverified",
      "?usedBy=documents",
    ];

    for (const query of queries) {
      // Parsed against each side's own entries: the filter vocabulary is derived
      // from the catalogue, so this also checks the projection offers the same options.
      const filters = parseSourceCatalogueFilters(new URLSearchParams(query), ENTRIES);
      const projectedFilters = parseSourceCatalogueFilters(new URLSearchParams(query), projected);
      expect(projectedFilters, `query ${query || "(none)"}`).toEqual(filters);
      const fromFull = filterAndSortSourceCatalogue(ENTRIES, filters);
      const fromProjected = filterAndSortSourceCatalogue(projected, projectedFilters);
      expect(
        fromProjected.map((entry) => entry.id),
        `query ${query || "(none)"}`,
      ).toEqual(fromFull.map((entry) => entry.id));
    }

    expect(deriveSourceCatalogueFacets(projected)).toEqual(deriveSourceCatalogueFacets(ENTRIES));
  });

  it("produces the same status flags and provenance notes", () => {
    const projected = projectSourceCatalogueForClient(ENTRIES);
    for (const [index, entry] of ENTRIES.entries()) {
      expect(sourceAttentionFlags(projected[index]), entry.id).toEqual(sourceAttentionFlags(entry));
      expect(sourceProvenanceNotes(projected[index]), entry.id).toEqual(sourceProvenanceNotes(entry));
    }
  });

  it("measurably shrinks what crosses the wire", () => {
    const full = JSON.stringify(ENTRIES).length;
    const projected = JSON.stringify(projectSourceCatalogueForClient(ENTRIES)).length;
    // Guards the win rather than pinning an exact byte count that every content change
    // would churn: the two fields are ~20% of the serialised catalogue.
    expect(projected).toBeLessThan(full * 0.85);
  });
});
