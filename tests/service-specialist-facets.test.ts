import { describe, expect, it } from "vitest";

import { loadServicesSnapshot } from "@/lib/service-catalog";
import { mapCatalogToServiceRecords } from "@/lib/service-catalog-mapper";
import {
  deriveServiceFacetOptions,
  emptyServiceFacetSelection,
  filterServicesByFacets,
  serviceCatalogTags,
  serviceFacetDimensionLabels,
  serviceFacetDimensions,
  serviceFacetSelectionFromParams,
  serviceFacetValueLabel,
  writeServiceFacetSelectionToParams,
} from "@/lib/service-facets";

const records = mapCatalogToServiceRecords(loadServicesSnapshot().services);

describe("service specialist facets", () => {
  it("exposes governed specialist groups as a first-class service facet", () => {
    expect(serviceFacetDimensions).toContain("specialist_groups");
    expect(serviceFacetDimensionLabels.specialist_groups).toBe("Specialist pathway");

    const options = deriveServiceFacetOptions(records, "specialist_groups");
    expect(options.length).toBeGreaterThan(0);
    expect(records.some((record) => serviceCatalogTags(record).specialist_groups.length > 0)).toBe(true);
    for (const value of options) expect(serviceFacetValueLabel("specialist_groups", value)).not.toBe(value);
  });

  it("filters specialist groups with the same OR-within and AND-across contract as other facets", () => {
    const options = deriveServiceFacetOptions(records, "specialist_groups");
    const first = options[0];
    expect(first).toBeTruthy();

    const selection = {
      ...emptyServiceFacetSelection(),
      specialist_groups: new Set([first]),
    };
    const matches = filterServicesByFacets(records, selection, "all");
    expect(matches.length).toBeGreaterThan(0);
    for (const record of matches) expect(serviceCatalogTags(record).specialist_groups).toContain(first);
  });

  it("round-trips specialist pathway selections through shareable services URLs", () => {
    const selection = {
      ...emptyServiceFacetSelection(),
      specialist_groups: new Set(["aboriginal_torres_strait_islander", "child_youth"]),
    };
    const params = new URLSearchParams();
    writeServiceFacetSelectionToParams(params, selection);

    expect(params.get("specialist_groups")).toBe("aboriginal_torres_strait_islander,child_youth");
    expect([...serviceFacetSelectionFromParams(params).specialist_groups]).toEqual([
      "aboriginal_torres_strait_islander",
      "child_youth",
    ]);
  });
});
