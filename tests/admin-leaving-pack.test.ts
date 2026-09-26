import { describe, expect, it } from "vitest";

import { buildLeavingPack, leavingPackFileName } from "@/lib/admin/leaving-pack";
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
