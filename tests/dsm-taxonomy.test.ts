import { describe, expect, it } from "vitest";
import { loadSpecifiersContent, specifierCatalogItems, specifierSlug } from "@/lib/specifiers-content";
import { specifierIndexItems } from "@/lib/specifiers-search-index";

describe("DSM-5-TR & ICD-11 Taxonomy Structure", () => {
  it("splits Trance Disorder into distinct 6B62 and 6B63 diagnosis nodes in category 'dis'", () => {
    const content = loadSpecifiersContent();
    const disCategory = content.categories.find((c) => c.id === "dis");
    expect(disCategory).toBeDefined();

    const tranceDisorder = disCategory?.disorders.find((d) => d.name === "Trance Disorder (ICD-11)");
    const possessionTranceDisorder = disCategory?.disorders.find(
      (d) => d.name === "Possession Trance Disorder (ICD-11)",
    );

    expect(tranceDisorder).toBeDefined();
    expect(possessionTranceDisorder).toBeDefined();

    // 6B62 is non-possession trance
    expect(tranceDisorder?.icd11Context).toMatch(/6B62/);
    expect(tranceDisorder?.icd11Context).toMatch(/without a replacing external identity/i);

    // 6B63 is possession trance
    expect(possessionTranceDisorder?.icd11Context).toMatch(/6B63/);
    expect(possessionTranceDisorder?.icd11Context).toMatch(/replaced by an external identity|spirit|power/i);
  });

  it("splits Trance Disorder into distinct 6B62 and 6B63 diagnosis nodes in category 'icd'", () => {
    const content = loadSpecifiersContent();
    const icdCategory = content.categories.find((c) => c.id === "icd");
    expect(icdCategory).toBeDefined();

    const tranceDisorder = icdCategory?.disorders.find((d) => d.name === "Trance Disorder");
    const possessionTranceDisorder = icdCategory?.disorders.find((d) => d.name === "Possession Trance Disorder");

    expect(tranceDisorder).toBeDefined();
    expect(possessionTranceDisorder).toBeDefined();

    expect(tranceDisorder?.icd11Context).toMatch(/6B62/);
    expect(possessionTranceDisorder?.icd11Context).toMatch(/6B63/);
  });

  it("prohibits representing possession trance as a mere subtype/specifier of 6B62", () => {
    const items = specifierCatalogItems();
    const tranceItems = items.filter((item) => /trance disorder/i.test(item.disorderName));

    // Both 6B62 and 6B63 items must document that 6B63 is a separate diagnosis rather than a modifier
    expect(tranceItems.length).toBeGreaterThanOrEqual(2);
    for (const item of tranceItems) {
      if (/possession/i.test(item.label)) {
        expect(item.label).toMatch(/6B63|separate/i);
        expect(item.definition?.meaning ?? "").toMatch(/6B62|6B63|separate diagnosis|two distinct diagnoses/i);
      }
    }
  });

  it("differentiates DID (6B64) which covers both possession and non-possession forms from Trance (6B62/6B63)", () => {
    const items = specifierCatalogItems();
    const didItem = items.find(
      (item) => /dissociative identity/i.test(item.disorderName) && /possession/i.test(item.label),
    );

    expect(didItem).toBeDefined();
    // DID allows both presentations under 6B64
    expect(didItem?.definition?.meaning ?? "").toMatch(/with or without|both|may occur/i);
  });

  it("indexes both 6B62 and 6B63 taxonomy nodes in search index with valid slugs", () => {
    const content = loadSpecifiersContent();
    const indexSlugs = new Set(specifierIndexItems.map((item) => item.slug));

    for (const category of content.categories) {
      if (category.id !== "dis" && category.id !== "icd") continue;
      for (const disorder of category.disorders) {
        if (!disorder.name.includes("Trance Disorder")) continue;
        for (const group of disorder.groups) {
          for (const item of group.items) {
            const slug = specifierSlug(item.review.rowKey);
            expect(indexSlugs.has(slug)).toBe(true);
          }
        }
      }
    }
  });
});
