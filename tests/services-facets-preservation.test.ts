import { describe, expect, it } from "vitest";

import { recordToRow, rowToServiceRecord, type RegistryRecordRow } from "@/lib/registry-records";
import {
  filterServicesByFacets,
  matchesServiceFacets,
  matchesSubstanceLens,
  serviceCatalogTags,
  serviceHasFacetMetadata,
  type ServiceFacetSelection,
} from "@/lib/service-facets";
import type { ServiceRecord } from "@/lib/services";

describe("Service record facet metadata preservation", () => {
  const sampleServiceRecord: ServiceRecord = {
    slug: "metro-youth-mental-health",
    title: "Metro Youth Mental Health Service",
    subtitle: "Specialised community youth mental health care",
    route: "Community / Outpatient",
    eligibility: "Young people aged 16-24 residing in the catchment area",
    cost: "Bulk billed / Free",
    referral: "GP or self-referral",
    location: "Perth, WA",
    bestUse: "Moderate to severe youth mental health difficulties",
    catalogueLabel: "Youth Mental Health",
    navigatorQuery: "youth mental health perth",
    tags: ["Youth", "Community", "Assessment", "Therapy"],
    catchments: ["North Metro", "South Metro"],
    statusChips: [{ label: "Open", tone: "success" }],
    primaryContact: {
      kind: "phone",
      value: "08 9000 0000",
      label: "Intake Line",
      detail: "Mon-Fri 8:30am - 4:30pm",
    },
    contacts: [
      {
        kind: "email",
        value: "intake@metroyouth.example.gov.au",
        label: "Referrals Inbox",
      },
    ],
    summaryCards: [
      {
        id: "service-model",
        title: "Service Model",
        detail: "Multidisciplinary outpatient team offering case management and therapy.",
      },
    ],
    referralInfo: [
      {
        label: "How to Refer",
        value: "Complete referral form and email to intake.",
      },
    ],
    criteria: [
      {
        tone: "meet",
        label: "Aged 16 to 24 years at time of referral.",
      },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: ["Contact details verified against service directory."],
    },
    source: {
      status: "Checked 2026-08-01",
      label: "Mental Health Service Directory",
    },
    catalogPayload: {
      tags: {
        catchments: ["North Metro", "South Metro"],
        age_groups: ["youth", "young_adult"],
        setting_flags: ["community", "public"],
        acuity_flags: ["moderate", "high"],
        substance_flags: ["general"],
        housing_flags: ["general"],
      },
    },
  };

  it("preserves all 6 facet dimensions through recordToRow and rowToServiceRecord", () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const insertRow = recordToRow(sampleServiceRecord, ownerId, "service");

    expect(insertRow.slug).toBe("metro-youth-mental-health");
    expect(insertRow.catchments).toEqual(["North Metro", "South Metro"]);
    expect(insertRow.tags).toEqual(["Youth", "Community", "Assessment", "Therapy"]);
    expect(insertRow.catalog_payload).toEqual(sampleServiceRecord.catalogPayload);

    // Simulate Supabase row hydration with DB-assigned fields
    const hydratedRow: RegistryRecordRow = {
      id: "rec_123",
      owner_id: ownerId,
      kind: "service",
      slug: insertRow.slug,
      title: insertRow.title,
      subtitle: insertRow.subtitle ?? null,
      route: insertRow.route ?? null,
      eligibility: insertRow.eligibility ?? null,
      cost: insertRow.cost ?? null,
      referral: insertRow.referral ?? null,
      location: insertRow.location ?? null,
      best_use: insertRow.best_use ?? null,
      catalogue_label: insertRow.catalogue_label ?? null,
      navigator_query: insertRow.navigator_query ?? null,
      tags: insertRow.tags ?? [],
      catchments: insertRow.catchments ?? [],
      status_chips: (insertRow.status_chips ?? []) as unknown as RegistryRecordRow["status_chips"],
      primary_contact: (insertRow.primary_contact ?? null) as unknown as RegistryRecordRow["primary_contact"],
      contacts: (insertRow.contacts ?? []) as unknown as RegistryRecordRow["contacts"],
      summary_cards: (insertRow.summary_cards ?? []) as unknown as RegistryRecordRow["summary_cards"],
      referral_info: (insertRow.referral_info ?? []) as unknown as RegistryRecordRow["referral_info"],
      criteria: (insertRow.criteria ?? []) as unknown as RegistryRecordRow["criteria"],
      verification: (insertRow.verification ?? {}) as unknown as RegistryRecordRow["verification"],
      source: (insertRow.source ?? {}) as unknown as RegistryRecordRow["source"],
      catalog_payload: (insertRow.catalog_payload ?? {}) as unknown as RegistryRecordRow["catalog_payload"],
      source_status: insertRow.source_status ?? "unknown",
      validation_status: insertRow.validation_status ?? "unverified",
      last_reviewed_at: null,
      review_due_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };

    const roundTripped = rowToServiceRecord(hydratedRow);

    expect(roundTripped.slug).toBe(sampleServiceRecord.slug);
    expect(roundTripped.title).toBe(sampleServiceRecord.title);
    expect(roundTripped.catchments).toEqual(sampleServiceRecord.catchments);
    expect(roundTripped.tags).toEqual(sampleServiceRecord.tags);

    // Assert facet tags extraction before and after round-trip
    const originalTags = serviceCatalogTags(sampleServiceRecord);
    const restoredTags = serviceCatalogTags(roundTripped);

    expect(restoredTags).toEqual(originalTags);
    expect(restoredTags.catchments).toEqual(["North Metro", "South Metro"]);
    expect(restoredTags.age_groups).toEqual(["youth", "young_adult"]);
    expect(restoredTags.setting_flags).toEqual(["community", "public"]);
    expect(restoredTags.acuity_flags).toEqual(["moderate", "high"]);
    expect(restoredTags.substance_flags).toEqual(["general"]);
    expect(restoredTags.housing_flags).toEqual(["general"]);
    expect(serviceHasFacetMetadata(roundTripped)).toBe(true);
  });

  it("evaluates facet filtering and substance lenses identically on round-tripped records", () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const insertRow = recordToRow(sampleServiceRecord, ownerId, "service");
    const hydratedRow = {
      ...insertRow,
      id: "rec_123",
      last_reviewed_at: null,
      review_due_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    } as unknown as RegistryRecordRow;

    const roundTripped = rowToServiceRecord(hydratedRow);

    const matchingSelection: ServiceFacetSelection = {
      catchments: new Set(["North Metro"]),
      age_groups: new Set(["youth"]),
      setting_flags: new Set(["community"]),
      acuity_flags: new Set(["high"]),
      housing_flags: new Set(["general"]),
    };

    const nonMatchingSelection: ServiceFacetSelection = {
      catchments: new Set(["Country / WA Country"]),
      age_groups: new Set(["older_adult"]),
      setting_flags: new Set(["hospital_residential"]),
      acuity_flags: new Set(["crisis_high"]),
      housing_flags: new Set(["home_based"]),
    };

    expect(matchesServiceFacets(roundTripped, matchingSelection)).toBe(true);
    expect(matchesServiceFacets(roundTripped, nonMatchingSelection)).toBe(false);

    expect(matchesSubstanceLens(roundTripped, "all")).toBe(true);
    expect(matchesSubstanceLens(roundTripped, "general")).toBe(true);
    expect(matchesSubstanceLens(roundTripped, "aod")).toBe(false);

    const filtered = filterServicesByFacets([roundTripped], matchingSelection, "general");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.slug).toBe("metro-youth-mental-health");

    const rejected = filterServicesByFacets([roundTripped], nonMatchingSelection, "general");
    expect(rejected).toHaveLength(0);
  });

  it("safely defaults missing facet metadata without crashing or dropping legacy records", () => {
    const legacyRecord: ServiceRecord = {
      slug: "legacy-unstructured-service",
      title: "Legacy Service Without Catalog Tags",
      tags: ["Legacy"],
    };

    const row = recordToRow(legacyRecord, "owner_123", "service");
    const hydratedRow = {
      ...row,
      id: "rec_legacy",
      last_reviewed_at: null,
      review_due_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    } as unknown as RegistryRecordRow;

    const roundTripped = rowToServiceRecord(hydratedRow);
    const tags = serviceCatalogTags(roundTripped);

    expect(tags.catchments).toEqual([]);
    expect(tags.age_groups).toEqual([]);
    expect(tags.setting_flags).toEqual([]);
    expect(tags.acuity_flags).toEqual([]);
    expect(tags.substance_flags).toEqual([]);
    expect(tags.housing_flags).toEqual([]);
    expect(serviceHasFacetMetadata(roundTripped)).toBe(false);

    // Legacy records with no facet metadata stay visible (return true) under any constraint
    const anySelection: ServiceFacetSelection = {
      catchments: new Set(["North Metro"]),
      age_groups: new Set(["youth"]),
      setting_flags: new Set(["community"]),
      acuity_flags: new Set(["crisis_high"]),
      housing_flags: new Set(["general"]),
    };
    expect(matchesServiceFacets(roundTripped, anySelection)).toBe(true);
    expect(matchesSubstanceLens(roundTripped, "aod")).toBe(true);
  });
});
