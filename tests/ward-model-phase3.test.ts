// tests/ward-model-phase3.test.ts
import { describe, expect, it } from "vitest";

import { DECLINE_REASONS, EXAMINATION_TO_BED_WINDOW_MINUTES } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { isOpen } from "../src/components/ward-management/ward-derivations";

describe("Phase 3 model additions", () => {
  it("records out-of-catchment as a decline reason", () => {
    expect(DECLINE_REASONS).toContain("out_of_catchment");
    expect(new Set(DECLINE_REASONS).size).toBe(DECLINE_REASONS.length);
  });

  it("gives every movement a withdrawn-referral list, even an empty one", () => {
    for (const movement of wardMovements) {
      expect(Array.isArray(movement.withdrawnReferrals)).toBe(true);
    }
  });

  it("never dates a form later than the placement request it belongs to", () => {
    // The legal clock starts when the person was formed; the ED clock when this department
    // raised the request. formedAt may precede openedAt and must never follow it.
    for (const movement of wardMovements) {
      if (movement.formedAt === undefined) continue;
      expect(movement.formedAt).toBeLessThanOrEqual(movement.openedAt);
    }
  });

  it("carries at least one community-formed patient whose legal clock started before arrival", () => {
    const communityFormed = wardMovements.filter(
      (movement) => movement.formedAt !== undefined && movement.formedAt < movement.openedAt,
    );
    expect(communityFormed.length).toBeGreaterThan(0);
  });

  it("carries at least one patient brought in under police escort", () => {
    expect(wardMovements.some((movement) => movement.arrivalMode === "police")).toBe(true);
  });

  it("carries at least one examined patient, and every examination is dated at or before now", () => {
    const examined = wardMovements.filter((movement) => movement.examination !== undefined);
    expect(examined.length).toBeGreaterThan(0);
    for (const movement of examined) {
      expect(movement.examination!.at).toBeLessThanOrEqual(NOW_ANCHOR);
    }
  });

  it("holds a bed only with a time for the hold to expire at", () => {
    for (const movement of wardMovements) {
      if (movement.stage !== "bed_held") continue;
      expect(movement.bedHeldUntil).toBeDefined();
    }
  });

  it("puts a patient on 1A while awaiting examination and on 3B once examined", () => {
    // Settled by the product owner: 1A means awaiting exam; 3B means in the department awaiting a
    // bed. Form 3A is not used. The form therefore follows the examination, in both directions.
    for (const movement of wardMovements) {
      const code = movement.legalForm?.code;
      if (code === "1A") expect(movement.examination).toBeUndefined();
      if (code === "3B") expect(movement.examination?.outcome).toBe("inpatient_order");
      expect(code).not.toBe("3A");
    }
  });

  it("carries at least one patient on each of 1A and 3B", () => {
    const codes = wardMovements.map((movement) => movement.legalForm?.code);
    expect(codes).toContain("1A");
    expect(codes).toContain("3B");
  });

  it("keeps every new field free of anything that identifies a person", () => {
    const forbidden = /\b(name|dob|date of birth|mrn|medical record|address|diagnosis)\b/i;
    // A guard that checks properties and never reads strings is how the Phase 1 privacy
    // defect survived (plan Global Constraints). Accumulate every string this loop actually
    // inspects and assert there is a real, non-trivial number of them — so a future edit that
    // empties withdrawnReferrals/escalation back out of the fixture turns this test red
    // instead of leaving it vacuously green.
    const inspected: string[] = [];
    for (const movement of wardMovements.filter(isOpen)) {
      for (const withdrawn of movement.withdrawnReferrals) {
        inspected.push(withdrawn.reason);
      }
      if (movement.escalation) {
        inspected.push(movement.escalation.contact);
      }
    }
    expect(inspected.length).toBeGreaterThanOrEqual(3);
    for (const text of inspected) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it("derives every 3B deadline from its own examination rather than inventing one", () => {
    // Fix round 2: all three 3B records once carried a hand-picked dueAt with no relationship
    // to their examination.at. Task 2's reducer derives dueAt as
    // examination.at + EXAMINATION_TO_BED_WINDOW_MINUTES when it records an inpatient order —
    // the fixture must derive it the same way, or a reducer-produced 3B and a fixture-seeded 3B
    // render as though they mean the same thing when they do not.
    const inpatientOrdered = wardMovements.filter((movement) => movement.examination?.outcome === "inpatient_order");
    expect(inpatientOrdered.length).toBeGreaterThan(0);
    for (const movement of inpatientOrdered) {
      expect(movement.legalForm?.dueAt).toBe(movement.examination!.at + EXAMINATION_TO_BED_WINDOW_MINUTES);
    }
  });
});
