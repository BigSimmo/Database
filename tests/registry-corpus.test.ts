import { describe, expect, it } from "vitest";

import { buildDefaultMedicationRows } from "../src/lib/medication-fixtures";
import { clinicalRegistryRowsToCorpusEntries, medicationRowsToCorpusEntries } from "../src/lib/registry-corpus";
import { registryCorpusDetailHref } from "../src/lib/registry-corpus-links";
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

  it("maps scalar medication tags into metadata.tags", () => {
    const rows = buildDefaultMedicationRows("22222222-2222-4222-8222-222222222222") as MedicationRecordRow[];
    const [entry] = medicationRowsToCorpusEntries(rows.map((row) => ({ ...row, tag: "alcohol" })));

    expect(entry?.metadata.tags).toEqual(["alcohol"]);
  });

  it("builds registry detail hrefs for embedded corpus rows", () => {
    expect(
      registryCorpusDetailHref({
        kind: "service",
        slug: "crisis-service",
      }),
    ).toBe("/services/crisis-service");
    expect(
      registryCorpusDetailHref({
        kind: "differential",
        slug: "first-episode-psychosis",
        subkind: "presentation",
        recordId: "44444444-4444-4444-8444-444444444444",
      }),
    ).toBe("/differentials/presentations/first-episode-psychosis");
  });
});
