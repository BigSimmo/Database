import { expect, it } from "vitest";
import { rosterMakerActionSchema, rosterAgreementActionSchema } from "@/lib/roster/maker/workflow-model";

const id = "5e000000-0000-4000-8000-000000000001";
it("requires review provenance and a current settings token", () => {
  const save = {
    action: "settings.save",
    expectedToken: "token",
    needs: [],
    rules: { minBreakHours: 10, maxHours7d: 60, source: "Team approved rules", reviewedOn: "2026-09-27" },
  };
  expect(rosterMakerActionSchema.safeParse(save).success).toBe(true);
  expect(rosterMakerActionSchema.safeParse({ ...save, expectedToken: undefined }).success).toBe(false);
  expect(rosterMakerActionSchema.safeParse({ ...save, rules: { ...save.rules, source: null } }).success).toBe(false);
});
it("accepts only immutable proposal identity and session-owned agreement", () => {
  expect(
    rosterMakerActionSchema.safeParse({
      action: "proposal.create",
      draftId: id,
      expectedVersion: 1,
      scope: "change",
      changeId: "12",
    }).success,
  ).toBe(true);
  expect(
    rosterMakerActionSchema.safeParse({ action: "proposal.create", draftId: id, expectedVersion: 1, scope: "change" })
      .success,
  ).toBe(false);
  expect(
    rosterMakerActionSchema.safeParse({ action: "proposal.publish", proposalId: id, assignments: [] }).success,
  ).toBe(false);
  expect(rosterAgreementActionSchema.safeParse({ action: "agree", proposalId: id, userId: id }).success).toBe(false);
});
