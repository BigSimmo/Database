import { describe, expect, it } from "vitest";
import { normalizeSearchText, rankCatalogRecords } from "../src/lib/catalog-search";

type Drug = { name: string };

const drugs: Drug[] = [
  { name: "Fluoxetine" },
  { name: "Duloxetine" },
  { name: "Prednisone" },
  { name: "Prednisolone" },
];

function search(query: string) {
  return rankCatalogRecords(drugs, query, {
    fields: [{ id: "name", weight: 8, text: (drug) => normalizeSearchText(drug.name) }],
    fullText: (drug) => normalizeSearchText(drug.name),
    exactValues: (drug) => [normalizeSearchText(drug.name)],
    exactBonus: 10,
  });
}

describe("catalogue drug-name typo recovery", () => {
  it("does not fuzzy-match a distinct long medication name beside an exact match", () => {
    expect(search("fluoxetine").map((match) => match.record.name)).toEqual(["Fluoxetine"]);
    expect(search("prednisone").map((match) => match.record.name)).toEqual(["Prednisone"]);
  });

  it("still recovers a single-edit typo in a long medication name", () => {
    expect(search("fluoxetne")[0]?.record.name).toBe("Fluoxetine");
    expect(search("prednisne")[0]?.record.name).toBe("Prednisone");
  });
});
