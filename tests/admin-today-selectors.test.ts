import { describe, expect, it } from "vitest";

import { selectNeedsYou, selectRenewNext, selectRequirementsSummary } from "@/lib/admin/today-selectors";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

// 09:00 on Sat 26 Sep 2026 in Perth. Every instant below is UTC, so the Perth
// day is fixed whatever the machine's own time zone is (spec review 13).
const NOW = new Date("2026-09-26T01:00:00Z");

describe("selectRenewNext", () => {
  it("prefers whichever candidate date sits nearest today, future or past", () => {
    // Opens 20 Sep (30-day default lead time), so it is inside its own
    // window today; 24 days from today to its 20 Oct expiry.
    const registration = complianceFixture("Medical registration", {
      category: "Registration",
      expiresOn: "2026-10-20",
    });
    // 25 days ago: further from today than the registration's 24.
    const training = complianceFixture("Fire training", { category: "Training", expiresOn: "2026-09-01" });
    expect(selectRenewNext([training, registration], undefined, NOW)).toMatchObject({
      kind: "compliance",
      title: "Medical registration",
      date: "2026-10-20",
      state: "in-lead-time",
    });
  });

  it("picks a passed date when it is nearer today than anything in its lead time", () => {
    const registration = complianceFixture("Medical registration", {
      category: "Registration",
      expiresOn: "2026-10-20",
    });
    // 3 days ago: nearer today than the registration's 24 days out.
    const wwc = complianceFixture("Working with Children card", { category: "Clearances", expiresOn: "2026-09-23" });
    expect(selectRenewNext([registration, wwc], undefined, NOW)).toMatchObject({
      kind: "compliance",
      title: "Working with Children card",
      date: "2026-09-23",
      state: "passed",
    });
  });

  it("includes the new job's start date as a candidate, and lets it win when nearest", () => {
    const registration = complianceFixture("Medical registration", {
      category: "Registration",
      expiresOn: "2026-10-20", // 24 days out
    });
    expect(selectRenewNext([registration], "2026-10-05", NOW)).toEqual({
      kind: "new-job",
      title: "New job starts",
      date: "2026-10-05",
      state: "before-start",
    });
  });

  it("breaks an exact tie in favour of the compliance item", () => {
    const registration = complianceFixture("Medical registration", {
      category: "Registration",
      expiresOn: "2026-10-20", // 24 days out
    });
    expect(selectRenewNext([registration], "2026-10-20", NOW)?.kind).toBe("compliance");
  });

  it("never offers a requirement whose lead time has not opened yet, or one with no date", () => {
    const tooEarly = complianceFixture("Credentialing", { category: "Credentialing", expiresOn: "2027-06-01" });
    const undated = complianceFixture("Police check", { category: "Clearances" });
    expect(selectRenewNext([tooEarly, undated], undefined, NOW)).toBeNull();
  });

  it("never offers a row flagged not for this job", () => {
    const flagged = complianceFixture("Working with Children card", {
      category: "Clearances",
      expiresOn: "2026-09-23",
      notForThisJob: true,
    });
    expect(selectRenewNext([flagged], undefined, NOW)).toBeNull();
  });

  it("returns null with nothing to show", () => {
    expect(selectRenewNext([], undefined, NOW)).toBeNull();
  });
});

describe("selectNeedsYou", () => {
  it("orders passed rows by consequence band, worst first, then groups every undated row into one", () => {
    // Worse consequence band, so it leads even though its date is later than training's.
    const wwc = complianceFixture("Working with Children card", {
      category: "Clearances",
      consequence: "stops-work",
      expiresOn: "2026-09-20",
    });
    const training = complianceFixture("Fire training", {
      category: "Training",
      consequence: "chased",
      expiresOn: "2026-09-03",
    });
    const police = complianceFixture("Police check", { category: "Clearances" });
    const flu = complianceFixture("Flu vaccine", { category: "Health" });
    const immunisation = complianceFixture("Immunisation", { category: "Health" });

    const needsYou = selectNeedsYou([wwc, training, police, flu, immunisation], NOW);

    expect(needsYou?.featured).toMatchObject({ kind: "passed", entry: wwc });
    expect(needsYou?.rows).toHaveLength(2);
    expect(needsYou?.rows[0]).toMatchObject({ kind: "passed", entry: training });
    expect(needsYou?.rows[1]).toMatchObject({
      kind: "not-recorded",
      titles: ["Police check", "Flu vaccine", "Immunisation"],
    });
  });

  it("drops entries flagged not for this job", () => {
    const flagged = complianceFixture("Working with Children card", {
      category: "Clearances",
      expiresOn: "2026-09-03",
      notForThisJob: true,
    });
    expect(selectNeedsYou([flagged], NOW)).toBeNull();
  });

  it("excludes the entry already shown on the Renew next card", () => {
    const wwc = complianceFixture("Working with Children card", { category: "Clearances", expiresOn: "2026-09-03" });
    expect(selectNeedsYou([wwc], NOW, { excludeEntryId: wwc.id })).toBeNull();
  });

  it("returns null once nothing needs the reader", () => {
    const future = complianceFixture("Indemnity", { category: "Indemnity", expiresOn: "2027-06-30" });
    expect(selectNeedsYou([future], NOW)).toBeNull();
  });
});

describe("selectRequirementsSummary", () => {
  it("counts real compliance rows against the catalogue, and leaves flagged rows out of the total", () => {
    const summary = selectRequirementsSummary([]);
    expect(summary.recorded).toBe(0);
    expect(summary.notForThisJob).toBe(0);
    expect(summary.total).toBeGreaterThan(0);
  });

  it("moves a flagged row out of the total rather than counting it as unrecorded", () => {
    const withoutFlag = selectRequirementsSummary([]);
    const registration = complianceFixture("Medical registration renewal", {
      category: "Registration",
      expiresOn: "2027-09-30",
      notForThisJob: true,
    });
    const withFlag = selectRequirementsSummary([registration]);
    expect(withFlag.total).toBe(withoutFlag.total - 1);
    expect(withFlag.notForThisJob).toBe(withoutFlag.notForThisJob + 1);
  });

  it("never counts an admin row that is not compliance at all", () => {
    const adminRow = onCallEntryFixture({ section: "logistics", details: { category: "Pay" } });
    expect(selectRequirementsSummary([adminRow])).toEqual(selectRequirementsSummary([]));
  });
});
