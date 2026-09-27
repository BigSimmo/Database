import { describe, expect, it } from "vitest";

import { ADMIN_REQUIREMENTS_CATALOGUE, requirementChecklistRows } from "@/lib/admin/requirements";
import {
  buildSetupComplianceEntry,
  needsSetup,
  setupRequirementRecorded,
  setupRequirementsToCreate,
} from "@/lib/admin/setup";
import { createOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { onCallDetailsSchemaFor } from "@/lib/on-call/entry-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

describe("setup creates compliance rows through the existing entry contract", () => {
  it("builds a private, typed, never-on-the-card registration row the API accepts", () => {
    const body = buildSetupComplianceEntry("registration", "2027-09-30", "a1b2");
    expect(createOnCallEntrySchema.safeParse(body).success).toBe(true);
    expect(onCallDetailsSchemaFor("logistics").safeParse(body.details).success).toBe(true);
    expect(body).toMatchObject({ section: "logistics", isPersonal: true, includeOnCard: false });
    expect(body.details).toMatchObject({
      kind: "compliance",
      category: "registration",
      requirementId: "medical-registration-renewal",
      expiresOn: "2027-09-30",
      provenance: "typed",
    });
    expect(body.title).toBe("Medical registration renewal");
  });

  it("builds a valid indemnity row too", () => {
    const body = buildSetupComplianceEntry("indemnity", "2027-06-30", "c3d4");
    expect(createOnCallEntrySchema.safeParse(body).success).toBe(true);
    expect(body.details).toMatchObject({
      category: "registration",
      requirementId: "professional-indemnity-insurance",
      expiresOn: "2027-06-30",
    });
    expect(body.title).toBe("Indemnity insurance declaration");
  });

  it("creates rows the Renewals checklist matches, so setup and the checklist agree", () => {
    const created = (["registration", "indemnity"] as const).map((kind, index) => {
      const body = buildSetupComplianceEntry(kind, "2027-06-30", `s${index}`);
      return onCallEntryFixture({ section: "logistics", title: body.title, details: body.details });
    });
    const rows = requirementChecklistRows(ADMIN_REQUIREMENTS_CATALOGUE, created);
    const byId = new Map(rows.map((row) => [row.item.id, row.state]));
    expect(byId.get("medical-registration-renewal")).toBe("needs-action");
    expect(byId.get("professional-indemnity-insurance")).toBe("needs-action");
  });

  it("still recognises a row an earlier setup wrote under the old titles", () => {
    const older = [complianceFixture("Professional indemnity", { category: "Indemnity", expiresOn: "2027-06-30" })];
    expect(setupRequirementRecorded(older, "indemnity")).toBe(true);
    expect(setupRequirementRecorded(older, "registration")).toBe(false);
  });

  it("counts a catalogue row recorded on Renewals as already set up", () => {
    const fromRenewals = [
      complianceFixture("Medical registration renewal", {
        category: "registration",
        requirementId: "medical-registration-renewal",
        expiresOn: "2027-09-30",
      }),
    ];
    expect(setupRequirementRecorded(fromRenewals, "registration")).toBe(true);
    expect(setupRequirementRecorded(fromRenewals, "indemnity")).toBe(false);
    expect(needsSetup(fromRenewals)).toBe(false);
  });

  it("never creates a second registration or indemnity row", () => {
    const existing = [complianceFixture("Medical registration", { category: "Registration", expiresOn: "2027-09-30" })];
    expect(setupRequirementsToCreate(existing, { registration: "2028-09-30", indemnity: "2027-06-30" })).toEqual([
      "indemnity",
    ]);
  });

  it("creates nothing for a date left blank or typed badly", () => {
    expect(setupRequirementsToCreate([], { registration: "", indemnity: "30/06/2027" })).toEqual([]);
  });

  it("creates both when neither is recorded yet", () => {
    expect(setupRequirementsToCreate([], { registration: "2028-09-30", indemnity: "2027-06-30" })).toEqual([
      "registration",
      "indemnity",
    ]);
  });
});

describe("needsSetup", () => {
  it("is true only while neither a registration nor an indemnity row exists", () => {
    expect(needsSetup([])).toBe(true);
    const adminRow = onCallEntryFixture({ section: "logistics", details: { category: "Pay" } });
    expect(needsSetup([adminRow])).toBe(true);
    const indemnity = complianceFixture("Indemnity", { category: "Indemnity", expiresOn: "2027-06-30" });
    expect(needsSetup([indemnity])).toBe(false);
  });
});
