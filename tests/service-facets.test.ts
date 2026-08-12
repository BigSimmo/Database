import { describe, expect, it } from "vitest";

import { loadServicesSnapshot } from "@/lib/service-catalog";
import {
  buildServiceFacetIndex,
  filterServicesByFacetIndex,
  projectServiceFacetCounts,
  serviceFacetGroupIds,
  serviceFacetGroupLabels,
  serviceFacetKey,
  type ServiceFacetGroupId,
} from "@/lib/service-facets";
import type { CatalogServiceTags } from "@/lib/service-catalog";
import type { ServiceRecord } from "@/lib/service-ranker";

const emptyTags: CatalogServiceTags = {
  catchments: [],
  age_groups: [],
  setting_flags: [],
  acuity_flags: [],
  substance_flags: [],
  housing_flags: [],
};

function service(slug: string, tags: Partial<CatalogServiceTags>): ServiceRecord {
  return { slug, title: slug, facets: { ...emptyTags, ...tags } };
}

describe("buildServiceFacetIndex", () => {
  const a = service("a", { acuity_flags: ["crisis_high"], catchments: ["Metro-wide"] });
  const b = service("b", { acuity_flags: ["crisis_high", "moderate"], catchments: ["Regional WA"] });
  const c = service("c", { acuity_flags: ["moderate"], catchments: ["Metro-wide"] });

  it("derives the option list from the data — a dimension with no members contributes no group", () => {
    const index = buildServiceFacetIndex([a, b, c]);
    expect(index.groups.find((group) => group.group === "setting_flags")).toBeUndefined();
    expect(index.groups.find((group) => group.group === "housing_flags")).toBeUndefined();
    const acuity = index.groups.find((group) => group.group === "acuity_flags");
    expect(acuity?.options.map((option) => option.value).sort()).toEqual(["crisis_high", "moderate"]);
  });

  it("formats a snake_case value as a title-cased label", () => {
    const index = buildServiceFacetIndex([a]);
    const acuity = index.groups.find((group) => group.group === "acuity_flags");
    expect(acuity?.options.find((option) => option.value === "crisis_high")?.label).toBe("Crisis High");
  });

  it("counts each option once per service, not once per occurrence", () => {
    const index = buildServiceFacetIndex([a, b, c]);
    const acuity = index.groups.find((group) => group.group === "acuity_flags");
    expect(acuity?.options.find((option) => option.value === "crisis_high")?.count).toBe(2); // a, b
    expect(acuity?.options.find((option) => option.value === "moderate")?.count).toBe(2); // b, c
  });
});

describe("filterServicesByFacetIndex", () => {
  const a = service("a", { acuity_flags: ["crisis_high"], catchments: ["Metro-wide"] });
  const b = service("b", { acuity_flags: ["crisis_high", "moderate"], catchments: ["Regional WA"] });
  const c = service("c", { acuity_flags: ["moderate"], catchments: ["Metro-wide"] });
  const index = buildServiceFacetIndex([a, b, c]);

  it("returns every entry when nothing is selected", () => {
    expect(
      filterServicesByFacetIndex(index, [])
        .map((s) => s.slug)
        .sort(),
    ).toEqual(["a", "b", "c"]);
  });

  it("widens within a group — two catchments is an OR, not an AND", () => {
    const selected = [serviceFacetKey("catchments", "Metro-wide"), serviceFacetKey("catchments", "Regional WA")];
    expect(
      filterServicesByFacetIndex(index, selected)
        .map((s) => s.slug)
        .sort(),
    ).toEqual(["a", "b", "c"]);
  });

  it("narrows across groups — a catchment plus an acuity is an AND", () => {
    const selected = [serviceFacetKey("catchments", "Metro-wide"), serviceFacetKey("acuity_flags", "crisis_high")];
    expect(filterServicesByFacetIndex(index, selected).map((s) => s.slug)).toEqual(["a"]);
  });
});

describe("projectServiceFacetCounts", () => {
  const a = service("a", { acuity_flags: ["crisis_high"], catchments: ["Metro-wide"] });
  const b = service("b", { acuity_flags: ["crisis_high", "moderate"], catchments: ["Regional WA"] });
  const c = service("c", { acuity_flags: ["moderate"], catchments: ["Metro-wide"] });
  const index = buildServiceFacetIndex([a, b, c]);

  it("returns the index unchanged when nothing is selected", () => {
    expect(projectServiceFacetCounts(index, [])).toBe(index.groups);
  });

  it("counts 'with the candidate added', not by narrowing the current subset", () => {
    // Selecting crisis_high (a, b) then hypothetically adding moderate WIDENS the acuity group
    // (OR within it) rather than narrowing it, so moderate's projected count is every entry
    // carrying crisis_high OR moderate — all three — not the 2 that already match crisis_high.
    const projected = projectServiceFacetCounts(index, [serviceFacetKey("acuity_flags", "crisis_high")]);
    const acuity = projected.find((group) => group.group === "acuity_flags")!;
    expect(acuity.options.find((option) => option.value === "moderate")?.count).toBe(3); // a, b, c
  });

  it("reports an already-selected option's own count as the current selection size", () => {
    const projected = projectServiceFacetCounts(index, [serviceFacetKey("acuity_flags", "crisis_high")]);
    const acuity = projected.find((group) => group.group === "acuity_flags")!;
    expect(acuity.options.find((option) => option.value === "crisis_high")?.count).toBe(2); // a, b
  });

  it("keeps a zero-count option in place as a dead end rather than dropping it", () => {
    const d = service("d", { catchments: ["Metro-wide"], acuity_flags: ["moderate"] });
    const e = service("e", { catchments: ["Regional WA"], acuity_flags: ["crisis_high"] });
    const deadEndIndex = buildServiceFacetIndex([d, e]);
    const projected = projectServiceFacetCounts(deadEndIndex, [serviceFacetKey("catchments", "Metro-wide")]);
    const acuity = projected.find((group) => group.group === "acuity_flags")!;
    // Only d matches catchments:Metro-wide, and d does not carry crisis_high —
    // so ticking it next would empty the set. It must stay listed at 0, not
    // disappear, so the reader can see which choice narrowed them to nothing.
    const crisisOption = acuity.options.find((option) => option.value === "crisis_high");
    expect(crisisOption).toBeDefined();
    expect(crisisOption?.count).toBe(0);
  });
});

describe("substance_flags is excluded from the facet dimensions", () => {
  it("ships neither in the group id list nor the label map", () => {
    expect(serviceFacetGroupIds).not.toContain("substance_flags" as ServiceFacetGroupId);
    expect(Object.keys(serviceFacetGroupLabels)).not.toContain("substance_flags");
    expect(serviceFacetGroupIds).toEqual([
      "catchments",
      "age_groups",
      "setting_flags",
      "acuity_flags",
      "housing_flags",
    ]);
  });

  it("is an exact partition across the real catalogue — the fact the lens decision rests on", () => {
    // Guards the artifact's finding (a): every one of the 219 catalogue services carries
    // exactly one of general/aod. If a future data change breaks this, a lens (single-select)
    // would silently start hiding services that legitimately carry both — this test is the
    // trip-wire for that regression, not a one-off measurement.
    const snapshot = loadServicesSnapshot();
    for (const catalogService of snapshot.services) {
      expect(catalogService.tags.substance_flags).toHaveLength(1);
      expect(["general", "aod"]).toContain(catalogService.tags.substance_flags[0]);
    }
  });
});
