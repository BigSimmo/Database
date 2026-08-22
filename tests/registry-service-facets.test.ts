import { describe, expect, it } from "vitest";

import { defaultServiceRecords } from "@/lib/registry-fixtures";
import { recordToRow, rowToServiceRecord, type RegistryRecordRow } from "@/lib/registry-records";
import { serviceCatalogTags, serviceFacetDimensions } from "@/lib/service-facets";
import type { ServiceRecord } from "@/lib/services";

const ownerId = "11111111-1111-4111-8111-111111111111";
const tagDimensions = [...serviceFacetDimensions, "substance_flags"] as const;

function roundTrip(record: ServiceRecord): ServiceRecord {
  const row = recordToRow(record, ownerId, "service");
  return rowToServiceRecord(row as RegistryRecordRow);
}

describe("registry service facet payloads", () => {
  it("preserves all six tag dimensions for the 219 default service records", () => {
    const records = defaultServiceRecords();

    expect(records).toHaveLength(219);
    for (const record of records) {
      const row = recordToRow(record, ownerId, "service");
      const restored = rowToServiceRecord(row as RegistryRecordRow);

      expect(row.catalog_payload).toEqual(record.catalogPayload);
      // Compare with the raw fixture payload rather than parsing both sides
      // through the same helper, which could let a parser regression agree
      // with itself.
      expect(serviceCatalogTags(restored)).toEqual(record.catalogPayload?.tags);
    }
  });

  it("degrades absent and malformed payloads to only their valid string-array values", () => {
    const absent = roundTrip({ slug: "absent", title: "Absent payload" });
    const malformedTags = roundTrip({
      slug: "malformed-tags",
      title: "Malformed tags",
      catalogPayload: { tags: "not-an-object" },
    });
    const partiallyMalformed = roundTrip({
      slug: "partially-malformed",
      title: "Partially malformed tags",
      catalogPayload: {
        tags: {
          catchments: [" Metro-wide ", "", 7, null],
          age_groups: "youth",
          setting_flags: null,
          acuity_flags: { value: "high" },
          substance_flags: [false, " aod "],
          housing_flags: [null, " home_based "],
        },
      },
    });

    for (const record of [absent, malformedTags]) {
      const tags = serviceCatalogTags(record);
      for (const dimension of tagDimensions) expect(tags[dimension]).toEqual([]);
    }
    expect(serviceCatalogTags(partiallyMalformed)).toEqual({
      catchments: ["Metro-wide"],
      age_groups: [],
      setting_flags: [],
      acuity_flags: [],
      substance_flags: ["aod"],
      housing_flags: ["home_based"],
    });
  });
});
