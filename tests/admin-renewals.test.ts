import { describe, expect, it } from "vitest";

import {
  buildNotForThisJobToggleBody,
  buildRenewedEntryBody,
  buildRestoreEntryBody,
  complianceExpiryHistory,
  groupComplianceEntries,
  renewalCalendarEvent,
  renewalsCalendarFile,
  workforceCopyText,
} from "@/lib/admin/renewals";
import { updateOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { mayContainOnCallCompliance } from "@/lib/on-call/compliance";
import { onCallDetailsSchemaFor } from "@/lib/on-call/entry-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

const NOW = new Date("2026-09-26T01:00:00Z"); // 09:00 Perth
const registration = complianceFixture("Medical registration", {
  category: "Registration",
  consequence: "stops-work",
  expiresOn: "2026-12-20",
  issuingBody: "The national board",
});

describe("the Renewed sheet's record", () => {
  it("stores the typed date, keeps the old one in history, and round-trips every other field", () => {
    const result = buildRenewedEntryBody(registration, {
      newExpiresOn: "2027-12-20",
      proofNote: "Email from the board, 3 Oct",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earlier).toBe(false);
    expect(updateOnCallEntrySchema.safeParse(result.body).success).toBe(true);
    expect(onCallDetailsSchemaFor("logistics").safeParse(result.body.details).success).toBe(true);
    expect(result.body.details).toMatchObject({
      expiresOn: "2027-12-20",
      expiryHistory: ["2026-12-20"],
      proofNote: "Email from the board, 3 Oct",
      provenance: "typed",
      issuingBody: "The national board",
    });
    expect(result.body.lastVerifiedAt).toBe(registration.lastVerifiedAt);
  });

  it("refuses a missing, malformed or unchanged date, and an over-long proof note", () => {
    const base = { proofNote: "" };
    expect(buildRenewedEntryBody(registration, { ...base, newExpiresOn: "" })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(buildRenewedEntryBody(registration, { ...base, newExpiresOn: "20/12/2027" })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(buildRenewedEntryBody(registration, { ...base, newExpiresOn: "2026-12-20" })).toEqual({
      ok: false,
      reason: "unchanged",
    });
    expect(buildRenewedEntryBody(registration, { newExpiresOn: "2027-12-20", proofNote: "x".repeat(121) })).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("saves an earlier date and says so, so the sheet can offer Undo instead of a confirm dialog", () => {
    const result = buildRenewedEntryBody(registration, { newExpiresOn: "2026-12-01", proofNote: "" });
    expect(result.ok && result.earlier).toBe(true);
  });

  it("restores the row exactly as it was for Undo", () => {
    const restore = buildRestoreEntryBody(registration);
    expect(updateOnCallEntrySchema.safeParse(restore).success).toBe(true);
    expect(restore.details).toEqual(registration.details);
  });

  it("keeps at most ten earlier dates, newest first", () => {
    const history = Array.from({ length: 10 }, (_, i) => `20${10 + i}-01-01`).reverse();
    const long = complianceFixture("Registration", {
      category: "Registration",
      expiresOn: "2026-12-20",
      expiryHistory: history,
    });
    const result = buildRenewedEntryBody(long, { newExpiresOn: "2027-12-20", proofNote: "" });
    expect(result.ok && complianceExpiryHistory({ ...long, details: result.body.details })).toEqual(
      ["2026-12-20", ...history].slice(0, 10),
    );
  });

  it("treats the new keys as compliance markers, so public reads and the device cache still fail closed", () => {
    expect(mayContainOnCallCompliance("logistics", { category: "Pay", proofNote: "x" })).toBe(true);
    expect(mayContainOnCallCompliance("logistics", { category: "Pay", expiryHistory: [] })).toBe(true);
    expect(mayContainOnCallCompliance("logistics", { category: "Pay", notForThisJob: true })).toBe(true);
  });
});

describe("Add to my calendar (spec review 9)", () => {
  it("is the calendar export's own expiry event, same id, with alerts at 09:00 Perth", () => {
    expect(renewalCalendarEvent(registration, NOW)).toMatchObject({
      id: `on-call-expiry-${registration.id}`,
      date: "2026-12-20",
      // start of the lead time (20 Nov) and one week before (13 Dec), each 09:00 Perth = 01:00 UTC
      alarmsAt: ["2026-11-20T01:00:00.000Z", "2026-12-13T01:00:00.000Z"],
    });
    expect(renewalCalendarEvent(complianceFixture("Undated", { category: "Training" }), NOW)).toBeNull();
  });

  it("drops an alert whose moment has already passed", () => {
    const soon = complianceFixture("ALS", { category: "Training", expiresOn: "2026-10-01" });
    expect(renewalCalendarEvent(soon, NOW)?.alarmsAt).toEqual([]);
  });

  it("writes one file with every dated renewal, two alarms each, and no calendar name", () => {
    const file = renewalsCalendarFile([registration, complianceFixture("Undated", { category: "Training" })], NOW);
    expect(file).not.toBeNull();
    expect(file!.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(file!.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(file!).toContain(`UID:on-call-expiry-${registration.id}@`);
    expect(file!).not.toContain("X-WR-CALNAME");
    expect(renewalsCalendarFile([], NOW)).toBeNull();
  });
});

describe("Copy for workforce", () => {
  it("heads the text exactly as the spec says and lists only compliance rows, blocking first", () => {
    const text = workforceCopyText(
      [
        registration,
        complianceFixture("Police check", { category: "Clearances" }),
        onCallEntryFixture({ section: "logistics", details: { category: "Pay" } }),
      ],
      NOW,
    );
    expect(text.split("\n")).toEqual([
      "Dates as I recorded them, copied 26 Sep 2026; not checked with issuers",
      "Medical registration (The national board): recorded as expiring 20 Dec 2026",
      "Police check: no expiry recorded",
    ]);
  });
});

describe('"Not for this job" (owner-approved, spec 28)', () => {
  it("splits compliance entries into counted and not-for-this-job groups, and counts recorded vs total", () => {
    const unrecorded = complianceFixture("Police check", { category: "Clearances" });
    const excluded = complianceFixture("Old college training", { category: "Training", notForThisJob: true });
    const groups = groupComplianceEntries([registration, unrecorded, excluded]);
    expect(groups.counted).toEqual([registration, unrecorded]);
    expect(groups.notForThisJob).toEqual([excluded]);
    expect(groups.counts).toEqual({ recorded: 1, total: 2, notForThisJob: 1 });
  });

  it("drops rows from other sections and non-compliance Admin rows, same as partitionLogisticsEntries", () => {
    const adminRow = onCallEntryFixture({ section: "logistics", details: { category: "Pay" } });
    const otherSection = onCallEntryFixture({ section: "contacts", details: { role: "Registrar" } });
    const groups = groupComplianceEntries([adminRow, otherSection]);
    expect(groups.counted).toEqual([]);
    expect(groups.notForThisJob).toEqual([]);
    expect(groups.counts).toEqual({ recorded: 0, total: 0, notForThisJob: 0 });
  });

  it("toggles the flag on and round-trips every other field", () => {
    const result = buildNotForThisJobToggleBody(registration, true);
    expect(updateOnCallEntrySchema.safeParse(result).success).toBe(true);
    expect(onCallDetailsSchemaFor("logistics").safeParse(result.details).success).toBe(true);
    expect(result.details).toMatchObject({ notForThisJob: true, expiresOn: "2026-12-20" });
    expect(result.lastVerifiedAt).toBe(registration.lastVerifiedAt);
  });

  it("clears the flag rather than storing it as false", () => {
    const flagged = complianceFixture("Old training", { category: "Training", notForThisJob: true });
    const result = buildNotForThisJobToggleBody(flagged, false);
    expect(result.details).not.toHaveProperty("notForThisJob");
  });

  it("undoes with buildRestoreEntryBody, following the Renewed sheet's own undo pattern", () => {
    const toggled = buildNotForThisJobToggleBody(registration, true);
    expect(toggled.details).not.toEqual(registration.details);
    const restored = buildRestoreEntryBody(registration);
    expect(updateOnCallEntrySchema.safeParse(restored).success).toBe(true);
    expect(restored.details).toEqual(registration.details);
  });
});
