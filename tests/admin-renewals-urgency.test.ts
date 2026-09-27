import { describe, expect, it } from "vitest";

import { catalogueItemForEntry, isPersonalRenewal } from "@/components/admin/renewals/catalogue-lookup";
import { requirementDateLine, requirementRowUrgency, shortStartDate } from "@/components/admin/renewals/urgency";
import { ADMIN_REQUIREMENTS_CATALOGUE } from "@/lib/admin/requirements";
import type { RequirementChecklistRow } from "@/lib/admin/requirements";
import { complianceFixture } from "./helpers/on-call-entry-fixture";

const NOW = new Date("2026-09-26T04:00:00.000Z"); // Perth: 26 Sep 2026, midday-ish

function row(overrides: Partial<RequirementChecklistRow>): RequirementChecklistRow {
  const item = ADMIN_REQUIREMENTS_CATALOGUE[0]!;
  return { item, entry: null, expiresOn: undefined, state: "not-recorded", ...overrides };
}

describe("shortStartDate", () => {
  it("prints day and month, never the year", () => {
    expect(shortStartDate("2026-11-02")).toBe("2 Nov");
    expect(shortStartDate("2027-08-30")).toBe("30 Aug");
  });
});

describe("requirementRowUrgency", () => {
  it("marks a not-recorded row with a dashed ring", () => {
    expect(requirementRowUrgency(row({ state: "not-recorded" }), NOW)).toEqual({
      shape: "ring",
      word: "Not recorded yet",
    });
  });

  it("marks a no-end-date row plain grey, with no shape", () => {
    expect(requirementRowUrgency(row({ state: "no-end-date" }), NOW)).toEqual({ shape: null, word: "Recorded" });
  });

  it("marks a passed date with a diamond, in words", () => {
    const entry = complianceFixture("Working with Children card", { category: "Checks", expiresOn: "2026-09-03" });
    expect(requirementRowUrgency(row({ state: "needs-action", entry, expiresOn: "2026-09-03" }), NOW)).toEqual({
      shape: "diamond",
      word: "Date passed",
    });
  });

  it("marks a row inside its own start-renewing window with a triangle", () => {
    // leadTimeDays defaults to 30; expiresOn 3 weeks out puts today inside the window.
    const entry = complianceFixture("Life support competence", { category: "Training", expiresOn: "2026-10-14" });
    expect(requirementRowUrgency(row({ state: "needs-action", entry, expiresOn: "2026-10-14" }), NOW)).toEqual({
      shape: "triangle",
      word: "Start renewing",
    });
  });

  it("marks a row not yet due for renewal with the future start date, and no shape", () => {
    const entry = complianceFixture("Professional indemnity", { category: "Indemnity", expiresOn: "2026-11-30" });
    expect(requirementRowUrgency(row({ state: "needs-action", entry, expiresOn: "2026-11-30" }), NOW)).toEqual({
      shape: null,
      word: "Start 31 Oct",
    });
  });
});

describe("requirementDateLine", () => {
  it("is null when nothing is recorded", () => {
    expect(requirementDateLine(undefined, NOW)).toBeNull();
  });

  it("prints the absolute date then the relative words", () => {
    expect(requirementDateLine("2026-09-03", NOW)).toBe("3 Sep 2026 · 3 weeks ago");
  });
});

describe("catalogueItemForEntry / isPersonalRenewal", () => {
  const catalogueItem = ADMIN_REQUIREMENTS_CATALOGUE[0]!;

  it("matches by a stored requirementId", () => {
    const entry = complianceFixture("Renamed row", { category: "Registration", requirementId: catalogueItem.id });
    expect(catalogueItemForEntry(entry)?.id).toBe(catalogueItem.id);
    expect(isPersonalRenewal(entry)).toBe(false);
  });

  it("matches by a case- and whitespace-insensitive title when there is no id", () => {
    const entry = complianceFixture(`  ${catalogueItem.title.toUpperCase()}  `, { category: "Registration" });
    expect(catalogueItemForEntry(entry)?.id).toBe(catalogueItem.id);
  });

  it("is personal when nothing in the catalogue matches", () => {
    const entry = complianceFixture("A car I lease for work", { category: "Personal" });
    expect(catalogueItemForEntry(entry)).toBeUndefined();
    expect(isPersonalRenewal(entry)).toBe(true);
  });
});
