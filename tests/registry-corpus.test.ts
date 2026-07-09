import { describe, expect, it } from "vitest";

import { clinicalRegistryRowsToCorpusEntries, medicationRowsToCorpusEntries } from "../src/lib/registry-corpus";
import type { MedicationRecordRow } from "../src/lib/medication-records";
import type { RegistryRecordRow } from "../src/lib/registry-records";

function registryRow(overrides: Partial<RegistryRecordRow> = {}): RegistryRecordRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: "22222222-2222-4222-8222-222222222222",
    kind: "service",
    slug: "crisis-service",
    title: "Crisis service",
    subtitle: "Urgent mental health access",
    route: "Call the crisis line before transfer",
    eligibility: "Acute mental health crisis",
    cost: "No cost",
    referral: "Phone referral required",
    location: "Perth",
    best_use: "Use for urgent triage",
    catalogue_label: "Service",
    navigator_query: "crisis service urgent triage",
    tags: ["crisis", "triage"],
    catchments: ["Perth"],
    status_chips: [],
    primary_contact: { label: "Phone", value: "Crisis line", kind: "phone" },
    contacts: [],
    summary_cards: [],
    referral_info: [],
    criteria: [],
    verification: { locallyVerified: true, confidence: "High", notes: ["Fixture"] },
    source: { label: "Local source", status: "Checked", reviewed: "July 2026", notes: [] },
    source_status: "current",
    validation_status: "locally_reviewed",
    last_reviewed_at: null,
    review_due_at: null,
    catalog_payload: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function medicationRow(overrides: Partial<MedicationRecordRow> = {}): MedicationRecordRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    owner_id: "22222222-2222-4222-8222-222222222222",
    slug: "lithium",
    name: "Lithium",
    accent: null,
    class: "Mood stabiliser",
    subclass: "Mineral",
    category: "mood-stabiliser",
    schedule: "S4",
    tag: "monitoring",
    quick: [],
    sections: [],
    stats: {},
    source_status: "current",
    validation_status: "locally_reviewed",
    last_reviewed_at: null,
    review_due_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("registry corpus", () => {
  it("converts registry rows into source-governed corpus entries", () => {
    const [entry] = clinicalRegistryRowsToCorpusEntries([registryRow()]);

    expect(entry).toMatchObject({
      kind: "service",
      subkind: "service",
      ownerId: "22222222-2222-4222-8222-222222222222",
      recordId: "11111111-1111-4111-8111-111111111111",
      slug: "crisis-service",
      title: "Crisis service",
      sourceStatus: "current",
      validationStatus: "locally_reviewed",
    });
    expect(entry?.content).toContain("Service: Crisis service");
    expect(entry?.content).toContain("Route: Call the crisis line before transfer");
    expect(entry?.searchText).toContain("crisis");
  });

  it("preserves form kind separately from service kind", () => {
    const [entry] = clinicalRegistryRowsToCorpusEntries([
      registryRow({ kind: "form", slug: "transport-order", title: "Transport order", catalogue_label: "Form" }),
    ]);

    expect(entry).toMatchObject({ kind: "form", subkind: "form", slug: "transport-order" });
    expect(entry?.content).toContain("Form: Transport order");
  });

  it("maps scalar medication tags into registry corpus metadata", () => {
    const [entry] = medicationRowsToCorpusEntries([medicationRow()]);

    expect(entry?.metadata.tags).toEqual(["monitoring"]);
  });
});
