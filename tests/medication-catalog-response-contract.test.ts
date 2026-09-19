/**
 * #8GB18R (d) — `/api/medications` responses were read with a blind `as T` cast.
 *
 * Nothing checked that the envelope still carried what the client believed it carried, so a
 * renamed or dropped key — `retainedSnapshot` above all — would have read as a perfectly
 * healthy live catalogue. That is the exact mechanism by which the 2026-09-16 registry outage
 * served a stale list for seven days without a word. The parser below is the medication
 * counterpart of `parseRegistryListResponse`: an exact envelope, fail-closed.
 */
import { describe, expect, it } from "vitest";

import { parseMedicationCatalogResponse } from "@/components/clinical-dashboard/use-medication-catalog";

const record = {
  slug: "clozapine",
  name: "Clozapine",
  class: "Antipsychotic",
  subclass: "Atypical",
  category: "psychotropic",
  accent: "teal",
  tag: "S4",
  schedule: "S4",
  stats: [],
  sections: [],
  quick: [],
};

function payload(extra: Record<string, unknown> = {}) {
  return {
    records: [record],
    total: 1,
    governance: { clozapine: { sourceStatus: "current", validationStatus: "approved" } },
    ...extra,
  };
}

describe("medication catalogue response contract", () => {
  it("accepts the shape the route actually sends", () => {
    expect(parseMedicationCatalogResponse(payload())).not.toBeNull();
  });

  it("keeps the degraded flag rather than quietly dropping it", () => {
    const parsed = parseMedicationCatalogResponse(payload({ retainedSnapshot: true }));
    expect(parsed?.retainedSnapshot).toBe(true);
  });

  it("accepts every envelope key the route can emit", () => {
    const parsed = parseMedicationCatalogResponse(
      payload({
        publicAccess: true,
        demoMode: true,
        retainedSnapshot: true,
        matches: [{ medication: record, result: { id: "clozapine", name: "Clozapine" }, score: 4, reasons: ["name"] }],
        interpretation: { correctedQuery: "clozapine", corrections: [{ from: "clozapin", to: "clozapine" }] },
      }),
    );
    expect(parsed?.matches).toHaveLength(1);
    expect(parsed?.interpretation?.correctedQuery).toBe("clozapine");
  });

  it("rejects an unknown envelope key, which is how a renamed degraded flag goes silent", () => {
    expect(parseMedicationCatalogResponse(payload({ retainedSnapshotV2: true }))).toBeNull();
  });

  it("rejects a degraded flag that is no longer a boolean", () => {
    expect(parseMedicationCatalogResponse(payload({ retainedSnapshot: "yes" }))).toBeNull();
  });

  it("rejects a malformed envelope outright", () => {
    expect(parseMedicationCatalogResponse(null)).toBeNull();
    expect(parseMedicationCatalogResponse([])).toBeNull();
    expect(parseMedicationCatalogResponse({ records: [record] })).toBeNull();
    expect(parseMedicationCatalogResponse(payload({ records: [{ slug: "x" }] }))).toBeNull();
    expect(parseMedicationCatalogResponse(payload({ total: -1 }))).toBeNull();
  });

  it("tolerates published fields this client has never heard of on a record", () => {
    // Canonical records are the database's own render payload. A new published field must not
    // blank the mode; only the envelope is key-exhaustive.
    expect(
      parseMedicationCatalogResponse(payload({ records: [{ ...record, newlyPublishedField: 1 }] })),
    ).not.toBeNull();
  });
});
