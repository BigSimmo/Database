import { describe, expect, it } from "vitest";

import {
  curatedEnrichmentFor,
  getSpecifierCatalogItem,
  popularCatalogSlugs,
  specifierCatalogItems,
  specifierSlug,
  specifiersStats,
} from "@/lib/specifiers-content";
import { searchSpecifierCatalog, specifierIndexItems, specifierVerifiedCount } from "@/lib/specifiers-search-index";

describe("specifiers content catalog", () => {
  it("flattens to the stats-reported item count", () => {
    // Assert stats↔content consistency plus a sanity floor, rather than a brittle
    // exact count (the dataset can gain/lose rows via governance edits).
    expect(specifierCatalogItems().length).toBe(specifiersStats().specifierItems);
    expect(specifiersStats().specifierItems).toBeGreaterThan(550);
  });

  it("assigns a unique slug to every item", () => {
    const items = specifierCatalogItems();
    const slugs = new Set(items.map((item) => item.slug));
    expect(slugs.size).toBe(items.length);
  });

  it("derives URL-safe slugs from the row key", () => {
    expect(specifierSlug("specifier:ndv:x:severity:mild")).toBe("specifier-ndv-x-severity-mild");
    expect(specifierCatalogItems().every((item) => /^[a-z0-9-]+$/.test(item.slug))).toBe(true);
  });

  it("round-trips getSpecifierCatalogItem by slug", () => {
    const sample = specifierCatalogItems()[0];
    expect(getSpecifierCatalogItem(sample.slug)?.label).toBe(sample.label);
    expect(getSpecifierCatalogItem("does-not-exist")).toBeUndefined();
  });

  it("keeps the compact client index in sync with the full catalog", () => {
    const catalogSlugs = new Set(specifierCatalogItems().map((item) => item.slug));
    expect(specifierIndexItems.length).toBe(catalogSlugs.size);
    expect(specifierIndexItems.every((item) => catalogSlugs.has(item.slug))).toBe(true);
  });

  it("never invents a definition for self-explanatory items", () => {
    for (const item of specifierCatalogItems()) {
      if (item.definitionStatus === "obvious-no-definition") {
        expect(item.definition).toBeNull();
      }
    }
  });

  it("pre-renders a bounded subset (source-verified) rather than all 586", () => {
    const slugs = popularCatalogSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.length).toBeLessThan(specifierCatalogItems().length);
    expect(slugs.length).toBe(Math.min(96, specifierVerifiedCount));
  });

  it("enriches a catalog item that matches a curated record", () => {
    const anxious = specifierCatalogItems().find((item) => /anxious distress/i.test(item.label));
    expect(anxious).toBeDefined();
    const enrichment = curatedEnrichmentFor(anxious!);
    expect(enrichment?.fit.length).toBeGreaterThan(0);
  });

  it("does not enrich generic labels from unrelated diagnostic categories", () => {
    // An Intellectual Developmental Disorder "Mild" severity row must not pick up
    // the mood "Mild severity" curated guidance.
    const nonMoodMild = specifierCatalogItems().find(
      (item) => item.categoryId === "ndv" && item.label.toLowerCase() === "mild",
    );
    expect(nonMoodMild).toBeDefined();
    expect(curatedEnrichmentFor(nonMoodMild!)).toBeUndefined();
  });

  it("confines enrichment to mood (bipolar/depressive) categories", () => {
    for (const item of specifierCatalogItems()) {
      if (!["bip", "dep"].includes(item.categoryId)) {
        expect(curatedEnrichmentFor(item)).toBeUndefined();
      }
    }
  });

  it("withholds unverified generated definitions behind a verification gate", () => {
    // Unverified auto-generated definitions were systematically mis-templated in the
    // source export, so every non-source-verified defined item must be demoted to
    // needs-manual-or-clinician-verification with a neutral placeholder — never
    // presenting fabricated clinical guidance as fact.
    for (const item of specifierCatalogItems()) {
      if (item.review.sourceVerificationStatus !== "source-verified" && item.definition) {
        expect(item.definitionStatus).toBe("needs-manual-or-clinician-verification");
        expect(item.definition.meaning).toMatch(/pending clinician verification/i);
      }
    }
  });

  it("only source-verified rows carry displayed definition text, free of cross-domain templates", () => {
    const shown = specifierIndexItems.filter((item) => item.meaning);
    expect(shown.length).toBe(specifierVerifiedCount);
    for (const item of shown) {
      expect(item.src).toBe("source-verified");
      expect(item.meaning).not.toMatch(/tic frequency|sexual-dysfunction context|personality change presentation/i);
    }
  });

  it("does not mislabel timing/onset specifiers as symptom-count thresholds", () => {
    // PTSD "delayed expression" is a timing threshold and Conduct "adolescent-onset"
    // is an age-of-onset threshold — neither is a symptom-count rule, so the
    // source-verified clinical note must not claim otherwise.
    const rows = specifierCatalogItems().filter(
      (item) =>
        (/post-traumatic stress disorder/i.test(item.disorderName) && /delayed expression/i.test(item.label)) ||
        (/conduct disorder/i.test(item.disorderName) && /adolescent-onset/i.test(item.label)),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const item of rows) {
      expect(item.definition?.clinicalNote ?? "").not.toMatch(/symptom-count threshold/i);
    }
  });

  it("keeps DSM Section III (AMPD) provenance DSM-specific, not ICD-11", () => {
    // The AMPD trait domains are DSM-5-TR Section III; the reference page derives the
    // source badge from sourceFamily, so it must not carry an ICD-11/WHO provenance.
    const ampd = specifierCatalogItems().filter((item) => /alternative model|ampd/i.test(item.disorderName));
    expect(ampd.length).toBeGreaterThan(0);
    for (const item of ampd) {
      expect(item.definition?.sourceFamily ?? "").not.toMatch(/icd-11|who/i);
    }
  });

  it("gives Gaming Disorder online/offline subtypes direction-specific definitions", () => {
    // The generator originally merged both subtypes into one "online or offline"
    // string; each subtype must describe its own direction.
    const gaming = specifierCatalogItems().filter(
      (item) => /gaming disorder/i.test(item.disorderName) && /predominantly (on|off)line/i.test(item.label),
    );
    expect(gaming.length).toBeGreaterThanOrEqual(2);
    for (const item of gaming) {
      const meaning = item.definition?.meaning ?? "";
      expect(meaning).not.toMatch(/online or offline/i);
      expect(meaning).toMatch(/online/i.test(item.label) ? /\bonline\b/i : /\boffline\b/i);
    }
  });
});

describe("searchSpecifierCatalog", () => {
  it("finds a known specifier by label", () => {
    const results = searchSpecifierCatalog("anxious distress");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => /anxious distress/i.test(result.item.label))).toBe(true);
  });

  it("returns the whole filtered category with an empty query", () => {
    const results = searchSpecifierCatalog("", { categoryId: "dep" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.item.categoryId === "dep")).toBe(true);
  });

  it("filters to source-verified items only", () => {
    const results = searchSpecifierCatalog("", { reviewedOnly: true });
    expect(results.length).toBe(specifierVerifiedCount);
    expect(results.every((result) => result.item.src === "source-verified")).toBe(true);
  });

  it("ranks an exact label match above incidental substring matches (case-insensitive)", () => {
    // A lowercase "mild" query must reward an exact "Mild" label (via the exact /
    // prefix / phrase bonuses) over rows that merely contain "mild" inside a
    // parenthetical severity range — which requires normalizing the haystacks.
    const results = searchSpecifierCatalog("mild");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.label.toLowerCase()).toBe("mild");
  });
});
