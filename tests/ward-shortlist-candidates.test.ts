// tests/ward-shortlist-candidates.test.ts
//
// ⚠️ THE DEFECT THIS REPLACES MADE WARDS INVISIBLE RATHER THAN REFUSED. The coordinator's shortlist
// dropped every ward of a different age group BEFORE eligibility was computed, so a coordinator
// could not see them, reason about them, or override them — they were simply not there.
//
// Hiding them was defensible until the engine learned to accept a reasoned placement. Now a
// judgement gate is overridable with a recorded reason, so a cohort-mismatched ward is a legitimate
// destination and hiding it is the defect. `cohort` is itself one of the overridable gates.
import { describe, expect, it } from "vitest";

import { blockingGate, shortlistCandidates } from "../src/components/ward-management/ward-derivations";
import { SUITABILITY_GATES, seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const state = seedWardFlowState();
const NOW = NOW_ANCHOR;
const movement = state.movements[0];
const all = shortlistCandidates(movement, state.units, NOW);

describe("shortlistCandidates — every ward, with an honest verdict", () => {
  it("returns EVERY unit, never a filtered subset", () => {
    expect(all.length, "one candidate per unit in the network").toBe(state.units.length);
    // Anti-vacuity: an empty network would satisfy the equality above while proving nothing.
    expect(state.units.length).toBeGreaterThan(10);
  });

  it("includes wards of a DIFFERENT cohort, which the old shortlist could never show", () => {
    // ⚠️ The exact defect: these were dropped before eligibility ran, so they were unreachable at
    // any price. They must now appear, with a verdict, whatever that verdict is.
    const otherCohort = all.filter((c) => c.unit.cohort !== movement.cohort);
    expect(otherCohort.length, "the network must actually contain other-cohort wards").toBeGreaterThan(0);
    for (const candidate of otherCohort) {
      expect(candidate.verdict.gates.length, "a verdict was computed rather than skipped").toBeGreaterThan(0);
    }
  });

  it("is capped by nothing", () => {
    // ⚠️ The list it replaces was capped at PARALLEL_REFERRAL_CAP — a rule about how many places one
    // referral may be SENT to, borrowed as a display count. Re-capping would restore the original
    // defect in a new costume: with three eligible wards present, every overridable one falls off
    // the end and is invisible again.
    expect(all.length).toBeGreaterThan(3);
  });
});

describe("shortlistCandidates — what a reason can and cannot buy", () => {
  it("marks a ward overridable ONLY when every failing gate is a judgement", () => {
    for (const candidate of all.filter((c) => c.availability === "overridable")) {
      const failing = candidate.verdict.gates.filter((gate) => !gate.pass);
      expect(failing.length, "an overridable ward must actually be failing something").toBeGreaterThan(0);
      for (const gate of failing) {
        expect(SUITABILITY_GATES, `${candidate.unit.name} fails ${gate.gate}`).toContain(gate.gate);
      }
    }
  });

  it("NEVER marks a ward overridable when a physical fact refuses it", () => {
    // ⚠️ The owner's rule, applied to the list rather than the engine: no reason typed into a form
    // creates a bed. A ward with no bed, no specialling capacity or a stale count must read as
    // plainly unavailable — offering it as overridable promises something no reason can buy.
    // ⚠️ RECONCILED 2026-09-02. This list had FOUR members and the reducer-level pin in
    // `ward-referral-reducer.test.ts` had THREE — two pins of the same concept, differing by one,
    // BOTH GREEN, because each asserted only its own layer's belief. Neither could ever fire.
    // That is "two things agreeing prove nothing" from the other side: two things DISAGREEING and
    // nothing noticing. `capacity_freshness` left the list by owner ruling; `prior_decline` was
    // never a world fact at all — it is informational, and it now has its own bucket.
    const worldFacts = ["allocatable_bed", "specialling"];
    for (const candidate of all.filter((c) => c.availability === "overridable")) {
      const failingNames = candidate.verdict.gates.filter((g) => !g.pass).map((g) => g.gate);
      for (const fact of worldFacts) {
        expect(failingNames, `${candidate.unit.name} must not be overridable`).not.toContain(fact);
      }
    }
  });

  it("an eligible ward fails nothing, and an unavailable one fails something outside the list", () => {
    for (const candidate of all) {
      const failing = candidate.verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
      if (candidate.availability === "eligible") {
        expect(failing, `${candidate.unit.name} is eligible`).toEqual([]);
      }
      if (candidate.availability === "unavailable") {
        expect(
          failing.some((gate) => !SUITABILITY_GATES.includes(gate)),
          `${candidate.unit.name} is unavailable for a reason no override covers`,
        ).toBe(true);
      }
    }
  });

  it("actually produces more than one kind of verdict on the seeded network", () => {
    // Anti-vacuity for the whole file: if every ward landed in one bucket, most assertions above
    // would hold trivially.
    const kinds = new Set(all.map((c) => c.availability));
    expect(kinds.size, `only saw ${[...kinds].join(", ")}`).toBeGreaterThan(1);
  });
});

describe("a ward that declined before is still reachable", () => {
  /**
   * ⚠️ THE SCREEN ASSERTED AN IMPOSSIBILITY THAT DID NOT EXIST. A ward failing only
   * `prior_decline` landed in the same bucket as one with zero beds, and its row read "No recorded
   * reason can place this person here" — while the REDUCER would have accepted the placement with
   * no reason at all, because `prior_decline` is absent from `SUITABILITY_GATES` and
   * `eligibilityRefusal` therefore never sees it.
   *
   * ⚠️ I INTRODUCED THIS, and measured it rather than guessing: the OLD `eligibleCandidatesAmong`
   * path returned `rph-adult-secure|prior_decline` and `fsh-adult-secure|prior_decline` as ordinary
   * SELECTABLE candidates for WF-009. They were visible and usable before my shortlist work and
   * unreachable after it.
   *
   * The clinical shape: a ward declines at 2pm because it is full, a bed frees at 8pm, and the
   * coordinator cannot re-approach it. The owner ruled that re-approaching needs NO written reason.
   *
   * ⚠️ AND THE FIX IS NOT TO ADD `prior_decline` TO `SUITABILITY_GATES` — that would make it
   * overridable-WITH-a-reason, which is what he ruled against. It gets its own bucket.
   */
  // WF-009 is the movement the seed records declines against — `state.movements[0]` has none, so
  // the suite's shared `all` cannot exercise this at all.
  const declinedMovement = state.movements.find((movement) => movement.id === "WF-009")!;
  const forDeclined = shortlistCandidates(declinedMovement, state.units, NOW);

  it("classifies a ward failing only prior_decline as usable, not as unavailable", () => {
    const declined = forDeclined.filter(
      (candidate) =>
        candidate.verdict.gates.some((gate) => !gate.pass && gate.gate === "prior_decline") &&
        candidate.verdict.gates.filter((gate) => !gate.pass).length === 1,
    );
    expect(declined.length, "the seed must contain a ward that only declined, or this proves nothing").toBeGreaterThan(
      0,
    );
    for (const candidate of declined) {
      expect(candidate.availability, `${candidate.unit.name} declined once and must stay reachable`).toBe(
        "previously_declined",
      );
    }
  });

  it("still reports the decline, because a coordinator should see that this ward said no before", () => {
    // The information is useful; the block was wrong. Losing the gate to fix the block would trade
    // one defect for a quieter one.
    const declined = forDeclined.find((candidate) => candidate.availability === "previously_declined")!;
    const gates = declined.verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(gates).toContain("prior_decline");
  });

  /**
   * ⚠️ THE CASE BOTH TESTS BELOW CLAIMED TO COVER DID NOT EXIST, AND THEY PASSED ANYWAY.
   *
   * Their first versions looped over the seeded candidates and asserted inside an `if`. NO SEEDED
   * WARD FAILS `prior_decline` AND A PHYSICAL GATE TOGETHER, so the `if` never fired for a declined
   * ward and both tests held over nothing. Proved by mutation: reverting `blockingGate` to its
   * pre-fix form, and making informational gates beat physical ones — the exact laundering defect —
   * each left 15 of 15 passing. Found by an adversarial reviewer, not by me writing them.
   *
   * ⚠️ A test that cannot fail is worse than no test, because it is counted.
   *
   * So the case is CONSTRUCTED here. The decline record is a real one from the seed with only its
   * `unitId` redirected — never a hand-authored object, which is how a fixture comes to carry three
   * invented fields and miss six required ones (see V11 in the verifier register).
   */
  const physicallyBlocked = forDeclined.find((candidate) =>
    candidate.verdict.gates.some(
      (gate) => !gate.pass && (gate.gate === "allocatable_bed" || gate.gate === "specialling"),
    ),
  );
  const laundering = {
    ...declinedMovement,
    declines: [...declinedMovement.declines, { ...declinedMovement.declines[0], unitId: physicallyBlocked!.unit.id }],
  };
  const launderedCandidate = shortlistCandidates(laundering, state.units, NOW).find(
    (candidate) => candidate.unit.id === physicallyBlocked!.unit.id,
  );

  it("a ward that declined AND fails a physical gate is still unavailable", () => {
    // ⚠️ Anti-vacuity FIRST, and on the property the assertion rests on — not on a list being
    // non-empty. Both of these were the missing guard.
    expect(physicallyBlocked, "the seed offers no physically blocked ward to attach a decline to").toBeDefined();
    expect(launderedCandidate, "the constructed movement produced no candidate for that ward").toBeDefined();
    const failing = launderedCandidate!.verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(failing, "the constructed ward does not actually carry a decline").toContain("prior_decline");
    expect(
      failing.some((gate) => gate === "allocatable_bed" || gate === "specialling"),
      "the constructed ward does not actually fail a physical gate, so this proves nothing",
    ).toBe(true);

    // The bucket is for wards whose ONLY failure is informational. A decline does not launder a
    // missing bed, and no reason typed into a form creates a bed.
    expect(
      launderedCandidate!.availability,
      `${launderedCandidate!.unit.name} fails a world fact and a decline has been allowed to hide it`,
    ).toBe("unavailable");

    // The seeded population still has to obey the same rule.
    for (const candidate of [...all, ...forDeclined]) {
      const gates = candidate.verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
      if (gates.includes("allocatable_bed") || gates.includes("specialling")) {
        expect(candidate.availability, `${candidate.unit.name} fails a world fact`).toBe("unavailable");
      }
    }
  });

  it("blockingGate names the physical gate, never the decline, on a ward that carries both", () => {
    // ⚠️ THE POINT OF `blockingGate`: showing "Already declined this movement" against a ward that
    // is unavailable because it has NO BED tells the coordinator the wrong thing is wrong.
    expect(launderedCandidate!.availability, "the constructed case is not unavailable, so this proves nothing").toBe(
      "unavailable",
    );
    const named = blockingGate(launderedCandidate!.verdict)?.gate;
    expect(named, "the shown gate is the decline, not the physical fact that actually blocks it").not.toBe(
      "prior_decline",
    );
    // Named positively too — `not.toBe` alone passes if it names nothing at all.
    expect(named, "no gate is named at all against an unavailable ward").toBeDefined();

    for (const candidate of [...all, ...forDeclined].filter((c) => c.availability === "unavailable")) {
      expect(blockingGate(candidate.verdict)?.gate).not.toBe("prior_decline");
    }
  });
});

describe("shortlistCandidates — ordering", () => {
  it("groups eligible first, then overridable, then unavailable", () => {
    const rank = { eligible: 0, previously_declined: 1, overridable: 2, unavailable: 3 } as const;
    const ranks = all.map((c) => rank[c.availability]);
    expect(ranks, "never a lower group before a higher one").toEqual([...ranks].sort((a, b) => a - b));
  });

  it("does not rank wards against each other inside a group", () => {
    // Between groups is not ranking — those are different claims. Within a group the order is the
    // network's own, so no ward is presented as the better choice than its neighbour.
    for (const availability of ["eligible", "previously_declined", "overridable", "unavailable"] as const) {
      const group = all.filter((c) => c.availability === availability).map((c) => c.unit.id);
      const networkOrder = state.units.filter((u) => group.includes(u.id)).map((u) => u.id);
      expect(group, `${availability} follows the network's own order`).toEqual(networkOrder);
    }
  });
});

describe("blockingGate — the reason shown against a ward nothing can buy", () => {
  /**
   * ⚠️ THIS WAS A LIVE DEFECT ON SCREEN AND A TEST DID NOT CATCH IT — looking at the rendered
   * coordinator panel did. The first version showed the FIRST failing gate, which meant an
   * unavailable ward could be labelled "Open ward does not meet a secure requirement" when what
   * actually blocked it was having NO BED. That names an OVERRIDABLE reason on a row no reason can
   * buy, and a coordinator reading it would reasonably conclude a recorded reason would get them in.
   */
  it("never names an overridable gate against an unavailable ward", () => {
    const unavailable = all.filter((c) => c.availability === "unavailable");
    expect(unavailable.length, "the seed must contain unavailable wards or this proves nothing").toBeGreaterThan(0);
    for (const candidate of unavailable) {
      const gate = blockingGate(candidate.verdict);
      expect(gate, `${candidate.unit.name} must have a blocking gate`).toBeDefined();
      expect(
        SUITABILITY_GATES,
        `${candidate.unit.name} is blocked by ${gate?.gate}, which a recorded reason CAN buy — the row would promise a way in that does not exist`,
      ).not.toContain(gate!.gate);
    }
  });

  it("picks the unbypassable gate even when an overridable one fails first", () => {
    // The exact shape of the defect: a ward failing BOTH kinds must report the one that actually
    // blocks it, not whichever the gate list happens to emit first.
    const both = all.find(
      (c) =>
        c.availability === "unavailable" &&
        c.verdict.gates.some((g) => !g.pass && SUITABILITY_GATES.includes(g.gate)) &&
        c.verdict.gates.some((g) => !g.pass && !SUITABILITY_GATES.includes(g.gate)),
    );
    expect(both, "the seed must contain a ward failing both kinds, or this test is vacuous").toBeDefined();
    const gate = blockingGate(both!.verdict);
    expect(SUITABILITY_GATES).not.toContain(gate!.gate);
  });
});
