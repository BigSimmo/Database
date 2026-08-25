// tests/ward-model-phase3.test.ts
import { describe, expect, it } from "vitest";

import { SELECTABLE_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import { DECLINE_REASONS } from "../src/components/ward-management/ward-model";
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

  /**
   * DELIBERATELY WEAKENED on 2026-08-24, and the weakening is the change, not an oversight.
   *
   * This used to pin the 1A/3B invariant in both directions — a movement on 1A has no
   * `examination`, a movement on 3B has one with outcome `inpatient_order`. That WAS the rule the
   * product owner asked to remove: the software no longer decides which form a patient is on, so
   * the form and the examination are independently recorded facts and neither implies the other.
   * Asserting the old invariant would now be asserting a rule the system does not have.
   *
   * What remains is the honest, weaker statement — the model RECORDS a form and infers none —
   * plus a non-vacuity floor, so this still goes red if the fixture stops carrying forms
   * altogether or starts carrying a code nobody declared.
   */
  it("records the form each patient is on and infers none from the examination", () => {
    const carried = wardMovements.filter((movement) => movement.legalForm !== undefined);

    // Non-vacuity floor: a fixture that carried no forms at all would make every claim below
    // pass while proving nothing.
    expect(carried.length, "no fixture movement carries a legal form").toBeGreaterThan(0);

    const declaredCodes = new Set(SELECTABLE_LEGAL_FORMS.map((form) => form.code));
    for (const movement of carried) {
      // Every form the fixture carries is one the picker could have produced — the fixture and
      // the clinician's choices come from the same declared set, and Form 3A is not in it.
      expect(declaredCodes, `${movement.id} carries an undeclared Form ${movement.legalForm!.code}`).toContain(
        movement.legalForm!.code,
      );
      expect(movement.legalForm!.code).not.toBe("3A");
    }

    // The examination is recorded independently of the form. Both combinations that the deleted
    // invariant forbade are now simply allowed, so the only thing pinned here is that an
    // examination, where present, is a real recorded outcome rather than something derived from
    // the form code.
    for (const movement of wardMovements) {
      if (movement.examination === undefined) continue;
      expect(["inpatient_order", "community_order", "revoked"]).toContain(movement.examination.outcome);
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
    //
    // Was `toBeGreaterThanOrEqual(3)` — the whole-branch review's fix for C2/I6
    // (`ward-movements.ts`'s WF-018) removed a `withdrawnReferrals` entry that named a referral
    // never actually raised (`ACCEPT_IN_PRINCIPLE` is the only reducer branch that ever writes
    // `withdrawnReferrals`, and WF-018 had no `acceptedUnitId` to pair it with — see
    // `tests/ward-flow-contracts.test.ts`'s new fixture-coherence invariants). The 3-count
    // threshold happened to be calibrated against that phantom entry: today's honest count is 2
    // (WF-006's real withdrawal plus WF-009's escalation contact) — still real and non-trivial,
    // just one fewer than a threshold that was quietly propped up by a fabricated record.
    const inspected: string[] = [];
    for (const movement of wardMovements.filter(isOpen)) {
      for (const withdrawn of movement.withdrawnReferrals) {
        inspected.push(withdrawn.reason);
      }
      if (movement.escalation) {
        inspected.push(movement.escalation.contact);
      }
    }
    expect(inspected.length).toBeGreaterThanOrEqual(2);
    for (const text of inspected) {
      expect(text).not.toMatch(forbidden);
    }
  });

  // Renamed and inverted 2026-08-23. Task 6A first established that a Form 3B carries no
  // `dueAt`: put to the clinician directly, he settled that the post-examination clock "is just
  // counting how long they have been in ED determining priority. So counting up," so no
  // post-examination deadline is recorded for a 3B. That was established while
  // this fixture still gave a Form 1A one. That 1A `dueAt` was never a real statutory figure —
  // it was an unverified number an earlier agent wrote into ward-model.ts from its own
  // recollection of the Act, not from the clinician or product owner. Put to the product owner
  // directly on 2026-08-23, the instruction was narrower than a corrected figure: drop the
  // legal countdown from this model entirely rather than get its number right ("please can you
  // leave the legal part and just start a clock once the patient arrives to ED. Keep it simple
  // for now"). So a 1A now carries no `dueAt` either — the same absence a 3B has always carried.
  // Both codes are accumulated so this cannot pass vacuously if the fixture ever stopped
  // carrying one kind or the other — a vacuous guard shape has already cost this phase two fix
  // rounds (see the deleted test this replaces).
  it("never gives any legal form — 1A or 3B — a dueAt", () => {
    const form3B: string[] = [];
    const form1A: string[] = [];
    for (const movement of wardMovements) {
      if (movement.legalForm?.code === "3B") form3B.push(movement.id);
      if (movement.legalForm?.code === "1A") form1A.push(movement.id);
    }
    expect(form3B.length).toBeGreaterThan(0);
    expect(form1A.length).toBeGreaterThan(0);
    for (const movement of wardMovements) {
      if (movement.legalForm?.code === "3B" || movement.legalForm?.code === "1A") {
        expect(movement.legalForm.dueAt, `${movement.id} (${movement.legalForm.code}) carries a dueAt`).toBeUndefined();
      }
    }
  });
});
