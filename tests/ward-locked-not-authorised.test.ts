// tests/ward-locked-not-authorised.test.ts
//
// 🔴 A LOCKED WARD AND A WARD THAT MAY LAWFULLY DETAIN ARE DIFFERENT FACTS, AND THIS IS THE ONLY
// THING IN THE REPOSITORY THAT SAYS SO.
//
// The owner ruled three ward categories — Open, Locked, Mixed — and the natural next simplification
// is to treat "locked" as meaning "takes involuntary patients". It is not. `Unit.authorised` is a
// statutory designation under the Mental Health Act 2014 (WA); `lockedBeds` describes doors. A
// private hospital can run a locked unit without being an authorised hospital.
//
// ⚠️ WHAT A MERGE WOULD DO. The authorisation gate reads `!authorisationNeeded || unit.authorised`.
// Collapse authorisation into the locked state and an unauthorised locked unit starts passing it
// for an involuntary patient — THE APP WOULD OFFER A BED FOR A DETENTION THAT UNIT CANNOT LAWFULLY
// HOLD. That is the worst error available in this domain, and it would arrive inside a change whose
// entire purpose was to remove a wrong clinical answer.
//
// The owner ruled on this knowing that consequence: "Go ahead with your recommendation being aware
// of when a unit is authorised vs unauthorised" `(OWNER, 2026-09-04)`.
//
// ⚠️ WHY A TEST AND NOT A COMMENT. `sjgs-adult-secure` is currently the only unit demonstrating the
// divergence. If somebody later tidies the fixture, the distinction disappears and nothing goes
// red — so the floor below fails loudly when the population empties, rather than passing while
// walking nothing. A guard that cannot fail reads as a safeguard and stops the next person looking.
import { describe, expect, it } from "vitest";

import { unitHasLockedBeds, wardCategory } from "@/components/ward-management/ward-bed-designation";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { allUnits } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

const NOW = 10 * 60 + 42;

describe("a locked ward that cannot lawfully detain", () => {
  const lockedAndUnauthorised = allUnits().filter((unit) => unitHasLockedBeds(unit) && !unit.authorised);

  // Floor the POPULATION, never the violation count. An empty set here means the fixture no longer
  // demonstrates the divergence at all, and every assertion below would be vacuous.
  it("exists in the network, or this whole file is examining nothing", () => {
    expect(
      lockedAndUnauthorised.map((unit) => unit.id),
      `no unit is both locked and unauthorised. Units with locked beds: ${allUnits()
        .filter(unitHasLockedBeds)
        .map((unit) => unit.id)
        .join(", ")}. If a fixture change removed the last one, restore it or replace this fixture ` +
        `with a constructed unit — do not delete this file, the property it guards is still true.`,
    ).not.toEqual([]);
  });

  it("is still classified as a locked or mixed ward — the category is about doors, not law", () => {
    for (const unit of lockedAndUnauthorised) {
      expect(wardCategory(unit), `${unit.id}`).not.toBe("Open");
    }
  });

  it("FAILS the authorisation gate for an involuntary movement, and fails it for that reason", () => {
    const involuntary = wardMovements.find((movement) => movement.legalStatus !== "Voluntary");
    expect(involuntary, "the fixture has no involuntary movement to test with").toBeDefined();

    for (const unit of lockedAndUnauthorised) {
      const verdict = eligibility({ ...involuntary!, cohort: unit.cohort, sex: "Male" }, unit, NOW);
      const authorisation = verdict.gates.find((gate) => gate.gate === "authorisation");

      expect(authorisation, `${unit.id}: no authorisation gate found`).toBeDefined();
      expect(authorisation?.pass, `${unit.id} is unauthorised but passed the authorisation gate`).toBe(false);

      // ⚠️ Two guards in series mask each other. If the security gate were also failing here, this
      // test would pass while proving nothing about authorisation. Assert the bed-kind gate PASSES,
      // so the refusal is demonstrably about lawfulness and not about the doors.
      const security = verdict.gates.find((gate) => gate.gate === "security");
      expect(
        security?.pass,
        `${unit.id}: the security gate blocked first, so the authorisation refusal above proves nothing`,
      ).toBe(true);
    }
  });
});
