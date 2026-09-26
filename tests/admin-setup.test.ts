import { describe, expect, it } from "vitest";

import { buildSetupComplianceEntry, needsSetup, setupRequirementsToCreate } from "@/lib/admin/setup";
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
      category: "Registration",
      expiresOn: "2027-09-30",
      provenance: "typed",
    });
  });

  it("builds a valid indemnity row too", () => {
    const body = buildSetupComplianceEntry("indemnity", "2027-06-30", "c3d4");
    expect(createOnCallEntrySchema.safeParse(body).success).toBe(true);
    expect(body.details).toMatchObject({ category: "Indemnity", expiresOn: "2027-06-30" });
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
