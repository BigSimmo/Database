import { describe, expect, it } from "vitest";

import {
  ADMIN_REQUIREMENT_GROUPS,
  ADMIN_REQUIREMENTS_CATALOGUE,
  requirementChecklistRows,
  requirementDateDescription,
  requirementsRecordedCount,
  type AdminRequirementCatalogueItem,
} from "@/lib/admin/requirements";
import { complianceFixture } from "./helpers/on-call-entry-fixture";

/** A minimal, self-contained catalogue item for tests that must not depend on
 *  the exact wording of the real 20-item content. */
function item(
  overrides: Partial<AdminRequirementCatalogueItem> & Pick<AdminRequirementCatalogueItem, "id" | "title">,
): AdminRequirementCatalogueItem {
  return {
    group: "registration",
    status: "confirmed",
    sourceName: "Test source",
    sourceUrl: "https://example.org/test",
    updated: "2026-09-26",
    rule: "A test rule.",
    ...overrides,
  };
}

describe("the requirements catalogue (requirements-content.md)", () => {
  it("has exactly 20 items, each with an https official source URL and the checked date", () => {
    expect(ADMIN_REQUIREMENTS_CATALOGUE).toHaveLength(20);
    for (const requirement of ADMIN_REQUIREMENTS_CATALOGUE) {
      expect(requirement.sourceUrl.startsWith("https://")).toBe(true);
      expect(requirement.updated).toBe("2026-09-26");
      expect(requirement.sourceName.trim().length).toBeGreaterThan(0);
    }
  });

  it("never states a needs-checking item's rule as fact", () => {
    for (const requirement of ADMIN_REQUIREMENTS_CATALOGUE) {
      if (requirement.status === "needs-checking") {
        expect(requirement.rule).toBeUndefined();
        expect(requirement.whatIsUnconfirmed?.trim().length).toBeGreaterThan(0);
      } else {
        expect(requirement.rule?.trim().length).toBeGreaterThan(0);
        expect(requirement.whatIsUnconfirmed).toBeUndefined();
      }
    }
  });

  it("gives each item a 2-4 word title and one of the five known groups", () => {
    for (const requirement of ADMIN_REQUIREMENTS_CATALOGUE) {
      const words = requirement.title.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(2);
      expect(words.length).toBeLessThanOrEqual(4);
      expect(ADMIN_REQUIREMENT_GROUPS).toContain(requirement.group);
    }
  });

  it("has no duplicate ids", () => {
    const ids = ADMIN_REQUIREMENTS_CATALOGUE.map((requirement) => requirement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matching a doctor's own entries to the catalogue", () => {
  const byId = item({ id: "req-a", title: "Widget licence" });
  const byTitle = item({ id: "req-b", title: "Gadget permit" });
  const unmatched = item({ id: "req-c", title: "Gizmo pass" });
  const catalogue = [byId, byTitle, unmatched];

  it("matches by a stored requirementId first, then by title, and leaves the rest as not-recorded slots", () => {
    const viaId = complianceFixture("My own name for it", {
      category: "Registration",
      requirementId: "req-a",
      expiresOn: "2027-03-01",
    });
    const viaTitle = complianceFixture("Gadget permit", { category: "Registration", expiresOn: "2027-04-01" });
    const rows = requirementChecklistRows(catalogue, [viaId, viaTitle]);
    expect(rows.find((row) => row.item.id === "req-a")?.entry).toBe(viaId);
    expect(rows.find((row) => row.item.id === "req-b")?.entry).toBe(viaTitle);
    expect(rows.find((row) => row.item.id === "req-c")?.entry).toBeNull();
    expect(rows.find((row) => row.item.id === "req-c")?.state).toBe("not-recorded");
  });

  it("treats a matching entry flagged not for this job as no match", () => {
    const flagged = complianceFixture("Gizmo pass", { category: "Registration", notForThisJob: true });
    const rows = requirementChecklistRows(catalogue, [flagged]);
    expect(rows.find((row) => row.item.id === "req-c")?.entry).toBeNull();
  });

  it("matches titles without regard to case or surrounding whitespace", () => {
    const viaTitle = complianceFixture("  gadget PERMIT  ", { category: "Registration", expiresOn: "2027-04-01" });
    const rows = requirementChecklistRows(catalogue, [viaTitle]);
    expect(rows.find((row) => row.item.id === "req-b")?.entry).toBe(viaTitle);
  });
});

describe("the recorded count", () => {
  const a = item({ id: "req-a", title: "Widget licence" });
  const b = item({ id: "req-b", title: "Gadget permit" });
  const c = item({ id: "req-c", title: "Gizmo pass" });
  const catalogue = [a, b, c];

  it("counts recorded items against the whole catalogue", () => {
    const recorded = complianceFixture("Widget licence", {
      category: "Registration",
      requirementId: "req-a",
      expiresOn: "2027-01-01",
    });
    expect(requirementsRecordedCount(catalogue, [recorded])).toEqual({ recorded: 1, total: 3 });
  });

  it("removes an item from both the recorded count and the total when its record is not for this job", () => {
    const flagged = complianceFixture("Widget licence", {
      category: "Registration",
      requirementId: "req-a",
      notForThisJob: true,
      expiresOn: "2027-01-01",
    });
    expect(requirementsRecordedCount(catalogue, [flagged])).toEqual({ recorded: 0, total: 2 });
  });
});

describe("checklist ordering (spec review 29: soonest first)", () => {
  const noEnd = item({ id: "no-end", title: "No end item" });
  const missing = item({ id: "missing", title: "Missing item" });
  const later = item({ id: "later", title: "Later item" });
  const soon = item({ id: "soon", title: "Soon item" });
  // Deliberately out of order, so a passing test proves the sort, not fixture order.
  const catalogue = [noEnd, missing, later, soon];

  it("orders items needing action soonest first, then no end date, then not recorded yet", () => {
    const entries = [
      complianceFixture("Later item", { category: "Registration", requirementId: "later", expiresOn: "2028-01-01" }),
      complianceFixture("Soon item", { category: "Registration", requirementId: "soon", expiresOn: "2027-01-01" }),
      complianceFixture("No end item", { category: "Registration", requirementId: "no-end" }),
    ];
    const rows = requirementChecklistRows(catalogue, entries);
    expect(rows.map((row) => row.item.id)).toEqual(["soon", "later", "no-end", "missing"]);
    expect(rows.map((row) => row.state)).toEqual(["needs-action", "needs-action", "no-end-date", "not-recorded"]);
  });
});

describe("requirementDateDescription", () => {
  const now = new Date("2026-09-26T01:00:00Z"); // 26 Sep 2026, 09:00 Perth

  it("describes a recorded date, and a date that has passed in words, never 'expired'", () => {
    expect(requirementDateDescription("2027-01-01", now)).toBe("Recorded as expiring 1 Jan 2027");
    expect(requirementDateDescription("2026-01-01", now)).toBe(
      "Recorded as expiring 1 Jan 2026 — that date has passed",
    );
    expect(requirementDateDescription("2026-01-01", now)).not.toMatch(/expired/i);
    expect(requirementDateDescription(undefined, now)).toBe("");
  });
});
