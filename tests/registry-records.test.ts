import { describe, expect, it } from "vitest";

import { rowToServiceRecord, type RegistryRecordRow } from "@/lib/registry-records";

function row(overrides: Partial<Record<string, unknown>> = {}): RegistryRecordRow {
  return {
    slug: "13yarn",
    title: "13YARN",
    subtitle: null,
    status_chips: [],
    primary_contact: null,
    contacts: [],
    route: null,
    eligibility: null,
    cost: null,
    referral: null,
    location: null,
    summary_cards: [],
    referral_info: [],
    best_use: null,
    criteria: [],
    verification: null,
    tags: [],
    catchments: [],
    catalogue_label: null,
    navigator_query: null,
    source: null,
    catalog_payload: {},
    ...overrides,
  } as unknown as RegistryRecordRow;
}

describe("rowToServiceRecord facets derivation", () => {
  it("derives the typed facet carrier from catalog_payload.tags, not the flattened tags column", () => {
    const record = rowToServiceRecord(
      row({
        // The flattened `tags` column deliberately disagrees with the payload here, so a
        // passing test proves `facets` came from `catalog_payload`, not from `tags`.
        tags: ["crisis"],
        catalog_payload: {
          tags: {
            catchments: ["Metro-wide"],
            age_groups: ["adult"],
            setting_flags: ["public"],
            acuity_flags: ["crisis_high"],
            substance_flags: ["general"],
            housing_flags: ["general"],
          },
        },
      }),
    );

    expect(record.facets).toEqual({
      catchments: ["Metro-wide"],
      age_groups: ["adult"],
      setting_flags: ["public"],
      acuity_flags: ["crisis_high"],
      substance_flags: ["general"],
      housing_flags: ["general"],
    });
  });

  it("degrades to all-empty dimensions when catalog_payload lacks tags, rather than throwing", () => {
    const record = rowToServiceRecord(row({ catalog_payload: {} }));
    expect(record.facets).toEqual({
      catchments: [],
      age_groups: [],
      setting_flags: [],
      acuity_flags: [],
      substance_flags: [],
      housing_flags: [],
    });
  });

  it("degrades to all-empty dimensions when catalog_payload is null, rather than throwing", () => {
    const record = rowToServiceRecord(row({ catalog_payload: null }));
    expect(record.facets).toEqual({
      catchments: [],
      age_groups: [],
      setting_flags: [],
      acuity_flags: [],
      substance_flags: [],
      housing_flags: [],
    });
  });

  it("degrades to all-empty dimensions when catalog_payload.tags is malformed, rather than throwing", () => {
    const record = rowToServiceRecord(row({ catalog_payload: { tags: "not-an-object" } }));
    expect(record.facets).toEqual({
      catchments: [],
      age_groups: [],
      setting_flags: [],
      acuity_flags: [],
      substance_flags: [],
      housing_flags: [],
    });
  });
});
