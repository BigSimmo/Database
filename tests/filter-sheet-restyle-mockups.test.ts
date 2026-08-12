import { describe, expect, it } from "vitest";

import {
  filterSheetRestyleCurrentQuery,
  filterSheetRestyleCurrentSubset,
} from "@/components/filter-sheet-restyle-mockups";
import { formulationMechanisms, searchFormulationMechanisms } from "@/lib/formulation";

describe("filter sheet restyle mockup scope", () => {
  it("grounds the two-result scope comparison in the production search", () => {
    expect(filterSheetRestyleCurrentSubset).toEqual(
      searchFormulationMechanisms(filterSheetRestyleCurrentQuery).map((result) => result.mechanism.name),
    );
    expect(filterSheetRestyleCurrentSubset).toHaveLength(2);
    expect(filterSheetRestyleCurrentSubset.length).toBeLessThan(formulationMechanisms.length);
  });
});
