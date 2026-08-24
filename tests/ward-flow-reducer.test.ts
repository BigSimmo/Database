import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { SELECTABLE_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function movement(state: ReturnType<typeof seeded>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

describe("seeding", () => {
  it("copies the fixture rather than aliasing it", () => {
    const first = seeded();
    const second = seeded();
    expect(first.movements[0]).not.toBe(second.movements[0]);
    expect(first.units[0]).not.toBe(second.units[0]);
  });

  it("starts with no refusals and a zero clock offset", () => {
    const state = seeded();
    expect(state.rejections).toEqual([]);
    expect(state.clockOffsetMinutes).toBe(0);
  });
});

describe("referral", () => {
  it("never refers above the parallel cap", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure", "gry-adult-secure"],
    });
    expect(next.rejections).toHaveLength(1);
    expect(movement(next, "WF-009").referredUnitIds).toHaveLength(0);
  });

  it("moves a referred movement to destination review", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(movement(next, "WF-009").stage).toBe("destination_review");
    expect(movement(next, "WF-009").referredUnitIds).toEqual(["rph-adult-secure", "fsh-adult-secure"]);
  });
});

describe("acceptance", () => {
  function referred() {
    return wardFlowReducer(seeded(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"],
    });
  }

  it("withdraws the other referrals and records each one", () => {
    const next = wardFlowReducer(referred(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    const target = movement(next, "WF-009");
    expect(target.acceptedUnitId).toBe("rph-adult-secure");
    expect(target.stage).toBe("accepted_awaiting_bed");
    expect(target.withdrawnReferrals.map((entry) => entry.unitId).sort()).toEqual([
      "fsh-adult-secure",
      "rgh-adult-secure",
    ]);
    for (const withdrawn of target.withdrawnReferrals) {
      expect(withdrawn.reason).toContain("RPH Adult Secure");
    }
  });

  it("refuses a second acceptance and says the referral was withdrawn", () => {
    const accepted = wardFlowReducer(referred(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    const next = wardFlowReducer(accepted, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "fsh-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toMatch(/withdraw/i);
    expect(movement(next, "WF-009").acceptedUnitId).toBe("rph-adult-secure");
  });
});

describe("the last bed", () => {
  it("refuses the second acceptance against a unit with one allocatable bed", () => {
    // Two patients, one bed. The model already names the answer; the reducer must enforce it.
    let state = seeded();
    const unit = state.units.find((candidate) => candidate.allocatable.value === 1);
    if (!unit) throw new Error("fixture no longer contains a single-allocatable-bed unit");

    for (const movementId of ["WF-009", "WF-017"]) {
      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId,
        unitIds: [unit.id],
      });
      state = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId,
        unitId: unit.id,
      });
      state = wardFlowReducer(state, { type: "HOLD_BED", role: "ward", now: NOW, movementId, unitId: unit.id });
    }

    expect(state.rejections.some((rejection) => rejection.reason.includes("bed_held_for_earlier_referral"))).toBe(true);
  });
});

describe("holds", () => {
  it("gives a held bed sixty minutes to lapse in", () => {
    let state = seeded();
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    state = wardFlowReducer(state, {
      type: "HOLD_BED",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    expect(movement(state, "WF-009").bedHeldUntil).toBe(NOW + 60);
    expect(movement(state, "WF-009").stage).toBe("bed_held");
  });
});

describe("roles", () => {
  it("refuses an event raised by the wrong role", () => {
    const next = wardFlowReducer(seeded(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toMatch(/role/i);
    expect(movement(next, "WF-009").acceptedUnitId).toBeUndefined();
  });
});

describe("arrival", () => {
  it("consumes the bed and closes the record", () => {
    let state = seeded();
    const before = state.units.find((unit) => unit.id === "rph-adult-secure")!.allocatable.value;
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "HOLD_BED", role: "ward", unitId: "rph-adult-secure" },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: "WF-009" } as never);
    }
    expect(state.rejections).toEqual([]);
    expect(movement(state, "WF-009").stage).toBe("arrived");
    const after = state.units.find((unit) => unit.id === "rph-adult-secure")!;
    expect(after.allocatable.value).toBeLessThan(before);
  });
});

describe("new referrals", () => {
  it("issues deterministic ids without any random source", () => {
    const first = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const second = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const firstId = first.movements[first.movements.length - 1].id;
    expect(firstId).toBe(second.movements[second.movements.length - 1].id);
    expect(first.movements).toHaveLength(second.movements.length);
  });

  it("gives a new referral an owner and the raising department", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 3,
        legalFormCode: null,
      },
    });
    const created = next.movements[next.movements.length - 1];
    expect(created.originEdId).toBe("jhc-ed");
    expect(created.owner.length).toBeGreaterThan(0);
    expect(created.stage).toBe("placement_requested");
    expect(created.withdrawnReferrals).toEqual([]);
  });

  /**
   * 2026-08-24: RAISE_REFERRAL used to DERIVE the form from `legalStatus` — a Form 1A for the two
   * awaiting-examination statuses, nothing otherwise. That derivation is deleted. The clinician
   * chooses the form on the intake form and the software chooses none, so the tests below pin the
   * choice being carried through faithfully in both directions: `null` means no form, a chosen
   * code means that form and no other, and the status has no say in either.
   */
  it("gives a referral with no form chosen no legal form at all", () => {
    const voluntary = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const voluntaryCreated = voluntary.movements[voluntary.movements.length - 1];
    expect(voluntaryCreated.legalForm).toBeUndefined();
    // `formedAt` used to be stamped in the same branch as the derived 1A. With the derivation
    // gone there is no rule left to hang it on and none was invented, so a runtime-raised
    // referral now carries no `formedAt` whatever the draft says. Pinned as an explicit absence
    // so a future edit cannot quietly reintroduce a stamping rule nobody asked for.
    expect(voluntaryCreated.formedAt).toBeUndefined();
  });

  it.each(["Referred for psychiatric examination", "Detained awaiting examination", "Voluntary"] as const)(
    "attaches the chosen Form 3D to a %s referral, and derives nothing from the status",
    (legalStatus) => {
      // 3D is the sharpest case in the whole change. The product owner named it as a form a
      // patient might be on; this model holds NO label and NO classification for it, so it is
      // offered as the bare code and carried as the bare code. Asserting the exact object is what
      // makes an invented label or `kind` fail here rather than reach a screen.
      const referred = wardFlowReducer(seeded(), {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          specialling: false,
          legalStatus,
          urgency: 2,
          legalFormCode: "3D",
        },
      });
      expect(referred.rejections).toEqual([]);
      const created = referred.movements.at(-1)!;
      expect(created.legalForm).toEqual({ code: "3D" });
      expect(created.legalForm?.kind).toBeUndefined();
      // The movement stores a code and nothing else — no title is copied onto it. The title a
      // reader sees comes from the register at render time, so it cannot go stale here.
      expect(Object.keys(created.legalForm!)).toEqual(["code"]);
      expect(created.legalForm?.dueAt).toBeUndefined();
      // The status had no say: a "Voluntary" draft carrying a 3D gets the 3D, and an
      // awaiting-examination draft gets the 3D too rather than the 1A the deleted rule imposed.
      expect(created.legalStatus).toBe(legalStatus);
      expect(created.formedAt).toBeUndefined();
    },
  );

  it.each(SELECTABLE_LEGAL_FORMS.map((form) => form.code))(
    "attaches the chosen Form %s exactly as declared",
    (code) => {
      const declared = SELECTABLE_LEGAL_FORMS.find((form) => form.code === code)!;
      const referred = wardFlowReducer(seeded(), {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          specialling: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: code,
        },
      });
      expect(referred.rejections).toEqual([]);
      const created = referred.movements.at(-1)!;
      expect(created.legalForm).toEqual(declared);
      // 2026-08-23 product-owner correction, still in force: no offered form carries a deadline.
      expect(created.legalForm?.dueAt).toBeUndefined();
      // The attached form must be a COPY, never the picker's own entry — a movement is mutable
      // state and the list is a shared module constant.
      expect(created.legalForm).not.toBe(declared);
    },
  );

  it("refuses a form code the picker does not offer rather than inventing or dropping one", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: "9Z",
      },
    });
    // Conservative failure: the referral is refused and visible in `rejections`, rather than
    // being created with a fabricated Form 9Z or with the clinician's choice silently discarded.
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("9Z");
    expect(next.movements).toHaveLength(seeded().movements.length);
  });
});

describe("purity", () => {
  it("never mutates the state it was given", () => {
    const state = seeded();
    const snapshot = JSON.stringify(state);
    wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("examination", () => {
  /**
   * 2026-08-24: recording an examination used to REPLACE a Form 1A with a Form 3B on an inpatient
   * order, and CLEAR the form entirely on a community order or a revocation. Both are deleted —
   * the form never changes by itself, in any outcome, and only the clinician changes it. These
   * three cases pin that across all three outcomes, so a form-touching branch cannot come back in
   * one of them unnoticed.
   */
  it.each(["inpatient_order", "community_order", "revoked"] as const)(
    "records a %s examination without touching the legal form",
    (outcome) => {
      // WF-001 is seeded on 1A ("Referral for examination", no examination recorded yet).
      const before = seeded();
      const formBefore = movement(before, "WF-001").legalForm;
      // Non-vacuity: this proves nothing unless the movement actually carries a form to leave alone.
      expect(formBefore?.code).toBe("1A");

      const next = wardFlowReducer(before, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW,
        movementId: "WF-001",
        outcome,
      });
      expect(next.rejections).toEqual([]);
      const target = movement(next, "WF-001");
      expect(target.examination).toEqual({ at: NOW, outcome });
      // Unchanged: still a 1A, still no 3B, still not cleared — and still no deadline.
      expect(target.legalForm).toEqual(formBefore);
      expect(target.legalForm?.dueAt).toBeUndefined();
    },
  );

  it("still refuses a second examination on the same movement", () => {
    // The one guard in this branch that is NOT a form rule and was deliberately kept: two
    // examinations against one movement is a data-integrity fault. Nothing else pinned it, and
    // with the form gate gone it is the only thing standing between the record and a duplicate.
    const once = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "inpatient_order",
    });
    expect(once.rejections).toEqual([]);
    const twice = wardFlowReducer(once, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 5,
      movementId: "WF-001",
      outcome: "community_order",
    });
    expect(twice.rejections).toHaveLength(1);
    expect(twice.rejections[0].reason).toContain("already examined");
    // The first examination stands unchanged; the refused second one wrote nothing.
    expect(movement(twice, "WF-001").examination).toEqual({ at: NOW, outcome: "inpatient_order" });
  });

  it("refuses an examination against a movement that has already closed", () => {
    // Fix wave 1, item 4. Every other movement-scoped handler already refused a closed movement;
    // this one did not, so an examination recorded against an ARRIVED patient overwrote the
    // arrival closure with `did_not_proceed`. Walked through real events rather than by
    // hand-setting `closure`.
    //
    // WF-012 rather than WF-009 ON PURPOSE: WF-009 already carries an examination in the fixture,
    // so the second-examination guard would refuse this too and the test would still pass with
    // the closure check deleted. WF-012 is Adult/Secure, at `placement_requested`, and carries NO
    // examination, so the closure check is the only thing that can refuse it — which is what
    // makes the mutation kill this test.
    const TARGET = "WF-012";
    const steps = [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "HOLD_BED", role: "ward", unitId: "rph-adult-secure" },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const;
    let state = seeded();
    for (const step of steps) {
      state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
    }
    expect(state.rejections).toEqual([]);
    const arrived = movement(state, TARGET);
    // Non-vacuity: the walk really did close this movement by arriving, so the refusal below is
    // about the closure and not about some earlier step having failed.
    expect(arrived.stage).toBe("arrived");
    expect(arrived.closure?.outcome).toBe("arrived");

    // Non-vacuity, and the whole reason this movement was chosen: it carries no examination, so
    // the second-examination guard cannot be what refuses the event below.
    expect(arrived.examination).toBeUndefined();

    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 500,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("closed movement");
    // The arrival stands: neither the closure nor the examination field was overwritten.
    expect(movement(after, TARGET).closure?.outcome).toBe("arrived");
    expect(movement(after, TARGET).examination).toBeUndefined();
  });

  it("still closes the movement without an inpatient bed when the examination is revoked", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "revoked",
    });
    const target = movement(next, "WF-001");
    expect(target.closure?.outcome).toBe("did_not_proceed");
  });

  /**
   * The three cases the deleted "form must be 1A" gate refused outright. Each raises a fresh
   * referral so the movement's form is exactly what this test says it is, rather than whatever
   * the fixture happens to carry.
   */
  it.each([["3B"], ["4A"], [null]] as const)("records an examination for a patient on %s", (legalFormCode) => {
    const referred = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode,
      },
    });
    const created = referred.movements.at(-1)!;
    // Non-vacuity: the movement really carries (or really lacks) the form this case is about.
    expect(created.legalForm?.code ?? null).toBe(legalFormCode);

    const next = wardFlowReducer(referred, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: created.id,
      outcome: "inpatient_order",
    });
    expect(next.rejections).toEqual([]);
    const target = movement(next, created.id);
    expect(target.examination).toEqual({ at: NOW + 1, outcome: "inpatient_order" });
    // Recorded, and the form is still exactly what the clinician selected.
    expect(target.legalForm).toEqual(created.legalForm);
  });

  it("cancels downstream transport, releases the held bed, and refuses further transitions when a movement closes", () => {
    // WF-005 is seeded at handover_ready, accepted at fre-adult-open, with a transport job
    // already accepted (but not yet en route). fre-adult-open's allocatable count reflects an
    // earlier HOLD_BED on this same movement.
    const before = seeded();
    const beforeUnit = before.units.find((candidate) => candidate.id === "fre-adult-open")!;

    const next = wardFlowReducer(before, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-005",
      outcome: "revoked",
    });
    const target = movement(next, "WF-005");
    expect(target.closure?.outcome).toBe("did_not_proceed");
    // Transport is cancelled, not silently left in its last live state.
    expect(target.transport?.cancelledAt).toBe(NOW);
    // The bed reserved by the earlier HOLD_BED is given back to the unit.
    const afterUnit = next.units.find((candidate) => candidate.id === "fre-adult-open")!;
    expect(afterUnit.allocatable.value).toBe(beforeUnit.allocatable.value + 1);

    // A closed movement can no longer be moved along the transport pathway — this reproduces
    // the reported defect, where TRANSPORT_EN_ROUTE was still accepted after the movement had
    // already been recorded as revoked.
    const enRoute = wardFlowReducer(next, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 5,
      movementId: "WF-005",
    });
    expect(enRoute.rejections).toHaveLength(1);
    expect(movement(enRoute, "WF-005").transport?.enRouteAt).toBeUndefined();
  });
});

describe("capacity confirmation", () => {
  it("writes the ward's restated allocatable count to that unit only", () => {
    const next = wardFlowReducer(seeded(), {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW,
      unitId: "rph-older-adult",
      value: 3,
    });
    const unit = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(unit.allocatable.value).toBe(3);
    expect(unit.allocatable.confirmedAt).toBe(NOW);
    // Untouched: a sibling unit's allocatable count must not move.
    const sibling = next.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(sibling.allocatable.value).toBe(1);
  });
});

describe("decline", () => {
  it("drops the unit from the live referral and records why", () => {
    // WF-010 is seeded at destination_review, referred only to sjgm-adult-open.
    const next = wardFlowReducer(seeded(), {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId: "WF-010",
      unitId: "sjgm-adult-open",
      reason: "out_of_catchment",
    });
    const target = movement(next, "WF-010");
    expect(target.declines).toContainEqual({
      unitId: "sjgm-adult-open",
      at: NOW,
      reason: "out_of_catchment",
      note: undefined,
    });
    expect(target.referredUnitIds).not.toContain("sjgm-adult-open");
    expect(target.stage).toBe("destination_review");
  });
});

describe("escalation", () => {
  it("stamps what was tried and who is being contacted", () => {
    // WF-010 carries no escalation at seed time.
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now: NOW,
      movementId: "WF-010",
      triedUnitIds: ["sjgm-adult-open", "rph-adult-secure"],
      contact: "State bed coordination desk",
    });
    expect(movement(next, "WF-010").escalation).toEqual({
      at: NOW,
      triedUnitIds: ["sjgm-adult-open", "rph-adult-secure"],
      contact: "State bed coordination desk",
    });
  });
});

describe("demo controls", () => {
  it("advances the clock offset by the given number of minutes", () => {
    const next = wardFlowReducer(seeded(), { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes: 15 });
    expect(next.clockOffsetMinutes).toBe(15);
  });

  it("resets a genuinely mutated state back to the seed, not just back to itself", () => {
    let state = seeded();
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    state = wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes: 30 });
    // Sanity: the mutation actually took, so the reset below is proving something real.
    expect(movement(state, "WF-009").referredUnitIds).toEqual(["rph-adult-secure"]);
    expect(state.clockOffsetMinutes).toBe(30);

    const reset = wardFlowReducer(state, { type: "RESET_SCENARIO", role: "demo", now: NOW });
    expect(movement(reset, "WF-009").referredUnitIds).toEqual([]);
    expect(reset.clockOffsetMinutes).toBe(0);
    expect(reset.rejections).toEqual([]);
  });
});

describe("arrival capacity floor", () => {
  it("refuses an arrival once the unit's physically empty beds are exhausted", () => {
    // A ward can CONFIRM_CAPACITY an allocatable count above what is physically empty — nothing
    // in HOLD_BED's own guard prevents that, since it only bounds `allocatable.value`. That makes
    // over-arriving a real, reachable sequence, not a hypothetical: hold and arrive one patient
    // against rph-adult-secure's single seeded allocatable bed (empty 2 -> 1), have the ward
    // restate a larger allocatable count than physically exists, then hold and arrive a second
    // patient (empty 1 -> 0), then attempt a third. The third must be refused rather than driving
    // `empty.value` negative.
    const walkToArrival = (state: ReturnType<typeof seeded>, movementId: string) => {
      const steps = [
        { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
        { type: "HOLD_BED", role: "ward", unitId: "rph-adult-secure" },
        { type: "HANDOVER_READY", role: "ed" },
        { type: "TRANSPORT_ACCEPTED", role: "officer" },
        { type: "TRANSPORT_EN_ROUTE", role: "officer" },
        { type: "PATIENT_COLLECTED", role: "officer" },
        { type: "PATIENT_ARRIVED", role: "officer" },
      ] as const;
      let next = state;
      for (const step of steps) {
        next = wardFlowReducer(next, { ...step, now: NOW, movementId } as never);
      }
      return next;
    };

    let state = seeded();
    state = walkToArrival(state, "WF-009"); // empty 2 -> 1, allocatable 1 -> 0
    state = wardFlowReducer(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW,
      unitId: "rph-adult-secure",
      value: 5,
    });
    state = walkToArrival(state, "WF-017"); // empty 1 -> 0, allocatable 5 -> 4

    const before = state.units.find((unit) => unit.id === "rph-adult-secure")!.empty.value;
    expect(before).toBe(0);

    // A third referral raised fresh, so its stage starts clean regardless of fixture state.
    const raised = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Secure",
        sex: "Male",
        specialling: false,
        legalStatus: "Voluntary",
        urgency: 3,
        legalFormCode: null,
      },
    });
    const thirdId = raised.movements[raised.movements.length - 1].id;
    const final = walkToArrival(raised, thirdId);

    expect(movement(final, thirdId).stage).not.toBe("arrived");
    expect(final.rejections.some((rejection) => rejection.reason.includes("no_bed"))).toBe(true);
    const after = final.units.find((unit) => unit.id === "rph-adult-secure")!;
    expect(after.empty.value).toBe(0);
  });
});
