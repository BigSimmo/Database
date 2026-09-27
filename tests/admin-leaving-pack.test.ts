import { describe, expect, it } from "vitest";

import {
  adminRecordsSections,
  adminRecordsText,
  buildLeavingPack,
  leavingPackFileName,
} from "@/lib/admin/leaving-pack";
import { ADMIN_REQUIREMENTS_CATALOGUE } from "@/lib/admin/requirements";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

const NOW = new Date("2026-09-25T16:30:00Z"); // 00:30 on 26 Sep in Perth, still 25 Sep in UTC

describe("the leaving pack", () => {
  it("holds every own Admin record, split into renewals, admin entries and contacts, and nothing else", () => {
    const pack = buildLeavingPack({
      ownEntries: [
        complianceFixture("Registration", { category: "Registration", expiresOn: "2027-09-30" }),
        onCallEntryFixture({ section: "logistics", details: { category: "Pay" }, title: "Payslips" }),
        onCallEntryFixture({ section: "contacts", details: { role: "Ward 4B" } }),
      ],
      now: NOW,
    });
    expect(pack.renewals.map((record) => record.title)).toEqual(["Registration"]);
    expect(pack.adminEntries.map((record) => record.title)).toEqual(["Payslips"]);
    expect(pack.contacts).toEqual([]);
    expect(pack.note).toBe("Your own Admin records as you entered them. Nothing here was checked with an issuer.");
    expect(JSON.stringify(pack)).not.toContain('"isOwn"');
  });

  it("names the file by the Perth day", () => {
    expect(leavingPackFileName(NOW)).toBe("admin-leaving-pack-2026-09-26.json");
  });
});

describe("Your Admin records (I7): what the page and Copy both list", () => {
  const renewed = complianceFixture("Working with Children Check", {
    category: "checks",
    requirementId: "working-with-children-check",
    expiresOn: "2029-03-01",
    expiryHistory: ["2026-03-01", "2023-03-01"],
    issuingBody: "WA Communities",
  });
  const flagged = complianceFixture("IMG visa requirements", {
    category: "job",
    requirementId: "img-visa-requirements",
    notForThisJob: true,
  });
  const loginTicked = onCallEntryFixture({
    section: "logistics",
    title: "Pager login",
    details: { category: "Logins", done: true },
  });
  const loginOpen = onCallEntryFixture({
    section: "logistics",
    title: "Email account",
    details: { category: "Logins" },
  });
  const guide = onCallEntryFixture({ section: "logistics", title: "Payslips", details: { category: "Pay" } });
  const sections = adminRecordsSections([renewed, flagged, loginTicked, loginOpen, guide]);
  const byLabel = new Map(sections.map((section) => [section.label, section]));

  it("gives each renewal its date and every earlier date", () => {
    const row = byLabel.get("Renewals")?.rows.find((candidate) => candidate.title.startsWith("Working with"));
    expect(row?.title).toBe("Working with Children Check");
    expect(row?.lines).toEqual([
      "Recorded as expiring 1 Mar 2029",
      "Recorded before: 1 Mar 2026, 1 Mar 2023",
      "Issued by WA Communities",
    ]);
  });

  it("lists what is not recorded yet and what is not for this job", () => {
    const notRecorded = byLabel.get("Not recorded yet")?.rows.map((row) => row.title) ?? [];
    expect(notRecorded).toContain("Medical registration renewal");
    expect(notRecorded).not.toContain("Working with Children Check");
    expect(notRecorded).not.toContain("IMG visa requirements");
    expect(notRecorded).toHaveLength(ADMIN_REQUIREMENTS_CATALOGUE.length - 2);
    expect(byLabel.get("Not for this job")?.rows.map((row) => row.title)).toEqual(["IMG visa requirements"]);
    expect(byLabel.get("Renewals")?.rows.map((row) => row.title)).not.toContain("IMG visa requirements");
  });

  it("shows New job ticks, and never calls an Admin guide 'not recorded'", () => {
    expect(byLabel.get("New job")?.rows).toEqual([
      { key: loginTicked.id, title: "Pager login", lines: ["Ticked"] },
      { key: loginOpen.id, title: "Email account", lines: ["Not ticked"] },
    ]);
    expect(byLabel.get("Admin")?.rows).toEqual([{ key: guide.id, title: "Payslips", lines: [] }]);
  });

  it("copies the same lines, dates included", () => {
    const text = adminRecordsText(sections, NOW);
    expect(text).toContain("- Working with Children Check\n  Recorded as expiring 1 Mar 2029");
    expect(text).toContain("Recorded as expiring 1 Mar 2029");
    expect(text).toContain("Recorded before: 1 Mar 2026, 1 Mar 2023");
    expect(text).toContain("Not for this job\n- IMG visa requirements");
    expect(text).toContain("- Pager login\n  Ticked");
    expect(text).toMatch(/^Your Admin records\nAs you recorded them · Sat 26 Sep 2026\n/);
  });
});
