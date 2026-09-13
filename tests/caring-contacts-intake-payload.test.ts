import { describe, expect, it } from "vitest";

import { demoActorForRole } from "@/lib/caring-contacts-server/session";
import { systemClock } from "@/lib/caring-contacts/clock";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import { idempotencyKey, patientId, referralId } from "@/lib/caring-contacts/ids";
import type { ReferralIntakePayload } from "@/lib/caring-contacts/repository";

const payload: ReferralIntakePayload = {
  patientIdentifier: "RPH-582914",
  givenName: "Mira",
  familyName: "Chen",
  mobileNumber: "+61491570006",
  dischargeDate: "2026-09-12T02:34:00.000Z",
  hospitalFacility: "Royal Perth Hospital",
  cohort: "adult_crisis",
  admittingWard: "Ward 4A",
  clinicalSummary: "Post-discharge aftercare required.",
  safetyAlerts: ["Acute distress", "Aftercare support required"],
};

describe("referral intake payload persistence", () => {
  it("stores the H-44 clinical payload with createReferral and round-trips it", async () => {
    const store = createInMemoryRepository(systemClock());
    const actor = demoActorForRole("coordinator");
    const nextReferralId = referralId("referral-intake-roundtrip");
    const nextPatientId = patientId("patient-intake-roundtrip");

    const created = await store.createReferral(
      { referralId: nextReferralId, patientId: nextPatientId, intakePayload: payload },
      { actor, idempotencyKey: idempotencyKey("intake-payload-create") },
    );
    expect(created.ok).toBe(true);

    const stored = await store.getReferralIntakePayload(nextReferralId, { actor });
    expect(stored).toEqual(payload);
  });

  it("returns null when createReferral omitted the clinical payload", async () => {
    const store = createInMemoryRepository(systemClock());
    const actor = demoActorForRole("coordinator");
    const nextReferralId = referralId("referral-intake-empty");
    const nextPatientId = patientId("patient-intake-empty");

    const created = await store.createReferral(
      { referralId: nextReferralId, patientId: nextPatientId },
      { actor, idempotencyKey: idempotencyKey("intake-payload-empty") },
    );
    expect(created.ok).toBe(true);
    await expect(store.getReferralIntakePayload(nextReferralId, { actor })).resolves.toBeNull();
  });
});
