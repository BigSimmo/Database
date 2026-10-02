import { describe, expect, it } from "vitest";

import { ADMIN_REQUIREMENTS_CATALOGUE } from "@/lib/admin/requirements";
import {
  COMING_UP_LIMIT,
  selectComingUp,
  selectNeedsYou,
  selectRenewNext,
  selectRequirementsSummary,
} from "@/lib/admin/today-selectors";
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

function catalogueOf(...ids: string[]) {
  return ADMIN_REQUIREMENTS_CATALOGUE.filter((item) => ids.includes(item.id));
}

describe("selectNeedsYou", () => {
  it("orders passed rows by consequence band, worst first, then groups everything not recorded into one", () => {
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
    // A personal renewal with no date: Renewals' Personal tab calls it "Not recorded yet".
    const police = complianceFixture("Police check", { category: "Clearances" });
    const catalogue = catalogueOf(
      "criminal-record-screening",
      "immunisation-requirements",
      "annual-influenza-vaccination",
    );

    const needsYou = selectNeedsYou([wwc, training, police], NOW, { catalogue });

    expect(needsYou?.featured).toMatchObject({ kind: "passed", entry: wwc });
    expect(needsYou?.rows).toHaveLength(2);
    expect(needsYou?.rows[0]).toMatchObject({ kind: "passed", entry: training });
    expect(needsYou?.rows[1]).toMatchObject({
      kind: "not-recorded",
      titles: ["Police check", "Criminal record screening", "Immunisation requirements", "Annual flu vaccination"],
    });
  });

  it("calls a catalogue item not recorded exactly when Renewals does, never a row recorded with no end date", () => {
    // Renewals shows this as "Recorded" under "No end date", so Today must not call it not recorded.
    const noEndDate = complianceFixture("Criminal record screening", {
      category: "checks",
      requirementId: "criminal-record-screening",
    });
    const catalogue = catalogueOf("criminal-record-screening", "annual-influenza-vaccination");
    const needsYou = selectNeedsYou([noEndDate], NOW, { catalogue });
    expect(needsYou?.featured).toMatchObject({ kind: "not-recorded", titles: ["Annual flu vaccination"] });
  });

  it("never names an item marked not for this job as not recorded", () => {
    const flagged = complianceFixture("IMG visa requirements", {
      category: "job",
      requirementId: "img-visa-requirements",
      notForThisJob: true,
    });
    const catalogue = catalogueOf("img-visa-requirements", "annual-influenza-vaccination");
    expect(selectNeedsYou([flagged], NOW, { catalogue })?.featured).toMatchObject({
      kind: "not-recorded",
      titles: ["Annual flu vaccination"],
    });
  });

  it("marks a passed row 'check with your service' only for a catalogue item whose rule is unconfirmed", () => {
    const indemnity = complianceFixture("Indemnity insurance declaration", {
      category: "registration",
      requirementId: "professional-indemnity-insurance",
      expiresOn: "2026-09-10",
    });
    const wwc = complianceFixture("Working with Children Check", {
      category: "checks",
      requirementId: "working-with-children-check",
      expiresOn: "2026-09-12",
    });
    const personal = complianceFixture("Car lease", { category: "Personal", expiresOn: "2026-09-14" });
    const needsYou = selectNeedsYou([indemnity, wwc, personal], NOW, { catalogue: [] });
    const passed = [needsYou?.featured, ...(needsYou?.rows ?? [])];
    const byTitle = new Map(
      passed.flatMap((row) => (row?.kind === "passed" ? [[row.entry.title, row.needsChecking] as const] : [])),
    );
    expect(byTitle.get("Indemnity insurance declaration")).toBe(true);
    expect(byTitle.get("Working with Children Check")).toBe(false);
    expect(byTitle.get("Car lease")).toBe(false);
  });

  it("drops entries flagged not for this job", () => {
    const flagged = complianceFixture("Working with Children card", {
      category: "Clearances",
      expiresOn: "2026-09-03",
      notForThisJob: true,
    });
    expect(selectNeedsYou([flagged], NOW, { catalogue: [] })).toBeNull();
  });

  it("excludes the entry already shown on the Renew next card", () => {
    const wwc = complianceFixture("Working with Children card", { category: "Clearances", expiresOn: "2026-09-03" });
    expect(selectNeedsYou([wwc], NOW, { excludeEntryId: wwc.id, catalogue: [] })).toBeNull();
  });

  it("returns null once nothing needs the reader", () => {
    const future = complianceFixture("Indemnity", { category: "Indemnity", expiresOn: "2027-06-30" });
    expect(selectNeedsYou([future], NOW, { catalogue: [] })).toBeNull();
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

  it("counts an item with two flagged rows once, and none while an unflagged row still records it", () => {
    const flaggedTwice = [1, 2].map(() =>
      complianceFixture("IMG visa requirements", {
        category: "job",
        requirementId: "img-visa-requirements",
        notForThisJob: true,
      }),
    );
    expect(selectRequirementsSummary(flaggedTwice).notForThisJob).toBe(1);
    const alsoRecorded = complianceFixture("IMG visa requirements", {
      category: "job",
      requirementId: "img-visa-requirements",
      expiresOn: "2027-01-01",
    });
    expect(selectRequirementsSummary([...flaggedTwice, alsoRecorded]).notForThisJob).toBe(0);
  });

  it("never counts an admin row that is not compliance at all", () => {
    const adminRow = onCallEntryFixture({ section: "logistics", details: { category: "Pay" } });
    expect(selectRequirementsSummary([adminRow])).toEqual(selectRequirementsSummary([]));
  });
});

describe("selectNeedsYou notRecordedCount", () => {
  it("counts every not-recorded date even when passed rows push the grouped row past the two-row cap", () => {
    const passed = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((expiresOn, index) =>
      complianceFixture(`Personal passed ${index}`, { category: "Training", expiresOn }),
    );
    const undated = complianceFixture("Personal undated", { category: "Training" });
    const needsYou = selectNeedsYou([...passed, undated], NOW);
    expect(needsYou?.rows.some((row) => row.kind === "not-recorded")).toBe(false);
    // One personal undated row plus every catalogue item with no row at all.
    expect(needsYou?.notRecordedCount).toBe(1 + ADMIN_REQUIREMENTS_CATALOGUE.length);
  });

  it("counts only catalogue items as recordable, since Record missing dates does not cover personal renewals", () => {
    const recordedAll = ADMIN_REQUIREMENTS_CATALOGUE.map((item) =>
      complianceFixture(item.title, { category: "Registration", requirementId: item.id, expiresOn: "2027-09-01" }),
    );
    const undated = complianceFixture("Personal undated", { category: "Training" });
    const needsYou = selectNeedsYou([...recordedAll, undated], NOW);
    expect(needsYou?.notRecordedCount).toBe(1);
    expect(needsYou?.recordableCount).toBe(0);
    expect(selectNeedsYou([undated], NOW)?.recordableCount).toBe(ADMIN_REQUIREMENTS_CATALOGUE.length);
  });

  it("is zero when nothing is unrecorded", () => {
    const recordedAll = ADMIN_REQUIREMENTS_CATALOGUE.map((item) =>
      complianceFixture(item.title, { category: "Registration", requirementId: item.id, expiresOn: "2026-09-01" }),
    );
    expect(selectNeedsYou(recordedAll, NOW)?.notRecordedCount).toBe(0);
  });
});

describe("selectComingUp", () => {
  const registration = complianceFixture("Medical registration", {
    category: "Registration",
    requirementId: "medical-registration-renewal",
    expiresOn: "2026-10-15",
  });
  const wwc = complianceFixture("Working with Children card", { category: "Clearances", expiresOn: "2026-09-03" });
  const flu = complianceFixture("Flu shot", { category: "Health", expiresOn: "2026-10-02" });
  const indemnity = complianceFixture("Indemnity", { category: "Indemnity", expiresOn: "2027-06-30" });
  const lastDay = complianceFixture("Last day in range", { category: "Training", expiresOn: "2027-09-26" });
  const tooFar = complianceFixture("Passport", { category: "Training", expiresOn: "2027-09-27" });
  const undated = complianceFixture("Police check", { category: "Clearances" });

  it("puts passed dates first under 'Date passed', then groups the next 12 months by Perth calendar month", () => {
    const comingUp = selectComingUp([indemnity, registration, tooFar, undated, flu, wwc, lastDay], NOW);
    expect(comingUp.groups.map((group) => [group.kind, group.label])).toEqual([
      ["passed", "Date passed"],
      ["month", "Oct 2026"],
      ["month", "Jun 2027"],
      ["month", "Sep 2027"],
    ]);
    expect(comingUp.groups[0].rows.map((row) => row.title)).toEqual(["Working with Children card"]);
    // Soonest first inside a month; a catalogue row carries the checklist's own title.
    expect(comingUp.groups[1].rows.map((row) => row.title)).toEqual(["Flu shot", "Medical registration renewal"]);
    expect(comingUp.groups[1].rows[1]).toEqual({
      entryId: registration.id,
      title: "Medical registration renewal",
      expiresOn: "2026-10-15",
    });
    // 365 days out is in; 366 is not; an undated row never appears.
    const titles = comingUp.groups.flatMap((group) => group.rows.map((row) => row.title));
    expect(titles).toContain("Last day in range");
    expect(titles).not.toContain("Passport");
    expect(titles).not.toContain("Police check");
    expect(comingUp).toMatchObject({ shown: 5, total: 5 });
  });

  it("turns over at Perth midnight, not UTC midnight", () => {
    const due = complianceFixture("Due today", { category: "Training", expiresOn: "2026-09-26" });
    // 23:30 UTC on 25 Sep is already 07:30 on 26 Sep in Perth: due today, not passed.
    expect(selectComingUp([due], new Date("2026-09-25T23:30:00Z")).groups[0].kind).toBe("month");
    // 16:30 UTC on 26 Sep is 00:30 on 27 Sep in Perth: the date has passed.
    expect(selectComingUp([due], new Date("2026-09-26T16:30:00Z")).groups[0].kind).toBe("passed");
  });

  it("caps the rows and reports the full total for 'See all in Renewals'", () => {
    const many = Array.from({ length: COMING_UP_LIMIT + 3 }, (_, index) =>
      complianceFixture(`Item ${index}`, {
        category: "Training",
        expiresOn: `2026-11-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    const comingUp = selectComingUp(many, NOW);
    expect(comingUp.groups.flatMap((group) => group.rows)).toHaveLength(COMING_UP_LIMIT);
    expect(comingUp).toMatchObject({ shown: COMING_UP_LIMIT, total: COMING_UP_LIMIT + 3 });
  });

  it("leaves out rows marked not for this job, as Renewals does", () => {
    const flagged = complianceFixture("Skipped", {
      category: "Training",
      expiresOn: "2026-10-20",
      notForThisJob: true,
    });
    expect(selectComingUp([flagged], NOW)).toEqual({ groups: [], shown: 0, total: 0 });
  });

  it("is empty when nothing is dated", () => {
    expect(selectComingUp([undated], NOW)).toEqual({ groups: [], shown: 0, total: 0 });
  });
});
