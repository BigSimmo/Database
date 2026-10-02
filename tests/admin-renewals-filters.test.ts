import { describe, expect, it } from "vitest";

import type { AdminRequirementCatalogueItem } from "@/lib/admin/requirements";
import {
  parseRenewalsShow,
  renewalsShowCounts,
  renewalsShowMatches,
  type RenewalsFilterItem,
} from "@/lib/admin/renewals-filters";
import { complianceFixture } from "./helpers/on-call-entry-fixture";

function item(id: string, title: string): AdminRequirementCatalogueItem {
  return {
    id,
    title,
    group: "registration",
    status: "confirmed",
    sourceName: "Test source",
    sourceUrl: "https://example.org/test",
    updated: "2026-09-26",
    rule: "A test rule.",
  };
}

const catalogue = [item("req-a", "Alpha permit"), item("req-b", "Beta permit"), item("req-c", "Gamma permit")];
// 2026-10-01 midday in Perth.
const now = new Date("2026-10-01T04:00:00Z");

const passed = complianceFixture("Alpha permit", { category: "Registration", expiresOn: "2026-09-19" });
const soon = complianceFixture("Beta permit", { category: "Registration", expiresOn: "2026-12-30" });
const personalSoon = complianceFixture("Personal thing", { category: "Registration", expiresOn: "2026-10-22" });
const personalLater = complianceFixture("Later thing", { category: "Registration", expiresOn: "2027-06-01" });
const personalFlagged = complianceFixture("Flagged thing", {
  category: "Registration",
  expiresOn: "2026-10-05",
  notForThisJob: true,
});
const personalUndated = complianceFixture("Undated thing", { category: "Registration" });
const own = [passed, soon, personalSoon, personalLater, personalFlagged, personalUndated];

function titleOf(entry: RenewalsFilterItem): string {
  return entry.kind === "catalogue" ? entry.row.item.title : entry.entry.title;
}

describe("Renewals show filters (Today's counts and the list they open)", () => {
  it("parses only the three known filters", () => {
    expect(parseRenewalsShow("due-90")).toBe("due-90");
    expect(parseRenewalsShow("everything")).toBeNull();
    expect(parseRenewalsShow(null)).toBeNull();
  });

  it("counts passed dates, the 90-day window and unrecorded catalogue items, counting undated personal renewals as not recorded and leaving out not-for-this-job rows", () => {
    expect(renewalsShowCounts(own, now, catalogue)).toEqual({ "date-passed": 1, "due-90": 2, "not-recorded": 2 });
  });

  it("lists the same rows it counts, soonest first, across checklist and personal renewals", () => {
    expect(renewalsShowMatches(own, "due-90", now, catalogue).map(titleOf)).toEqual(["Personal thing", "Beta permit"]);
    expect(renewalsShowMatches(own, "date-passed", now, catalogue).map(titleOf)).toEqual(["Alpha permit"]);
    expect(renewalsShowMatches(own, "not-recorded", now, catalogue).map(titleOf)).toEqual([
      "Undated thing",
      "Gamma permit",
    ]);
  });

  it("puts today inside the window and day 91 outside it", () => {
    const today = complianceFixture("Alpha permit", { category: "Registration", expiresOn: "2026-10-01" });
    const day91 = complianceFixture("Beta permit", { category: "Registration", expiresOn: "2026-12-31" });
    expect(renewalsShowCounts([today, day91], now, catalogue)["due-90"]).toBe(1);
  });
});
