import { describe, expect, it } from "vitest";

import {
  filterSheetRestyleCurrentQuery,
  filterSheetRestyleCurrentSubset,
  filterSheetRestyleDomainProportionPercent,
} from "@/components/filter-sheet-restyle-mockups";
import { formulationMechanisms, searchFormulationMechanisms } from "@/lib/formulation";

describe("filter sheet restyle mockup scope", () => {
  it("grounds the two-result scope comparison in the production search", () => {
    const productionSubset = searchFormulationMechanisms(filterSheetRestyleCurrentQuery).map(
      (result) => result.mechanism.name,
    );

    expect([...filterSheetRestyleCurrentSubset].sort()).toEqual(["Reassurance seeking", "Worry"]);
    expect([...productionSubset].sort()).toEqual([...filterSheetRestyleCurrentSubset].sort());
    expect(filterSheetRestyleCurrentSubset).toHaveLength(2);
    expect(filterSheetRestyleCurrentSubset.length).toBeLessThan(formulationMechanisms.length);
  });

  it("scales dense-list proportions against the active scope", () => {
    expect(filterSheetRestyleDomainProportionPercent(2, 2)).toBe(100);
    expect(filterSheetRestyleDomainProportionPercent(1, 2)).toBe(50);
    expect(filterSheetRestyleDomainProportionPercent(0, 0)).toBe(0);
  });
});
