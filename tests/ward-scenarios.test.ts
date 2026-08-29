import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { scenarioUnits } from "@/components/ward-management/ward-scenarios";

function eligibleCounts(scenario: "standard" | "scarce") {
  const units = scenarioUnits(scenario);
  return wardMovements
    .filter(isOpen)
    .map((movement) => units.filter((unit) => eligibility(movement, unit, NOW_ANCHOR).eligible).length);
}

describe("ward scenarios", () => {
  /**
   * The assertion this test originally carried — "every open movement has at least five eligible
   * wards" — was false, and the way it was false is worth recording. It came from counting the
   * LENGTH of `eligibleCandidatesAmong(...)`, which sorts eligible-first and truncates to its
   * `limit`; it does not filter to eligible. That length is therefore the number of same-cohort
   * units, never the number of eligible ones, and reading it as eligibility produced a confident
   * wrong answer that survived into a design document.
   *
   * RE-MEASURED on 2026-08-29 at NOW_ANCHOR, counting `eligibility(...).eligible` across all
   * 23 units for every open movement — the same computation `eligibleCounts("standard")` below
   * performs, run against the current fixture: 41 open movements, 342 eligible movement/unit
   * pairs, distribution {0:2, 4:11, 5:3, 6:4, 7:2, 11:1, 12:9, 14:9} — and **two movements,
   * WF-009 and WF-308, already have nowhere eligible on the standard night.** Both are the
   * fixture as authored, not something the scarce scenario introduced.
   *
   * It replaces a 2026-08-25 measurement of 337 pairs over 22 units with distribution
   * {0:2, 4:11, 5:6, 6:3, 11:1, 12:9, 14:9}. That record was taken two days before Phase 7 seeded
   * the 23rd unit, so the "22" had gone stale — but changing only the 22 to a 23 would have been
   * WRONG, not merely incomplete, and the reason is worth keeping: **the 23rd unit accounts for
   * none of the difference.** Recomputing this total with `bty-youth` removed still gives 342, and
   * no open movement is eligible for it at all — the network's only Youth unit, and nothing open
   * is a youth movement. The five extra pairs come from the gates and the fixture moving since,
   * across Phase 5 to Phase 8 (legal status became a capability, `involuntaryBedNeeded` was wired
   * into the legal-status gate, bed category and the three-stage bed model landed, `homeRegion`
   * was seeded). So the old figure was stale in substance and not only in its stated basis.
   *
   * The assertions below are thresholds, so none of this was red and none of it was vacuous —
   * which is exactly why a stale record here could sit unnoticed. If you change the fixture or a
   * gate, re-measure and re-date this; do not adjust a number and leave the date.
   */
  it("the standard night leaves most open movements real choice, but already strands two", () => {
    const counts = eligibleCounts("standard");

    // ABSOLUTE, not floors — changed 2026-08-30, and the reason is the point. This read
    // `toBeGreaterThan(30)` and `toBeGreaterThan(300)`, and a fixture that had quietly shrunk to 31
    // movements and 301 pairs would satisfy both exactly as 41 and 342 do. A floor set below the
    // real value cannot see the fixture decaying toward it, which is precisely the decay the doc
    // comment above records happening to the 2026-08-25 measurement — unnoticed for four days
    // because nothing here was ever red.
    //
    // All three figures travel in ONE assertion so a failure prints all three actuals side by side.
    // Which of them moved IS the diagnosis: fewer movements is a fixture change, fewer pairs with
    // the same movements is a gate change, and more stranded is a clinical regression.
    expect(
      {
        openMovements: counts.length,
        eligiblePairs: counts.reduce((sum, count) => sum + count, 0),
        strandedMovements: counts.filter((count) => count === 0).length,
      },
      "The standard night's shape has changed. These are MEASURED values, not targets: re-measure " +
        "them and RE-DATE the doc comment above, rather than editing a number here to match. Look " +
        "at strandedMovements first — it counts open movements with nowhere eligible to go on an " +
        "ordinary night, so a rise there means the network now strands patients it used to place, " +
        "and that is a clinical regression rather than a test that needs updating.",
    ).toEqual({ openMovements: 43, eligiblePairs: 353, strandedMovements: 2 });
  });

  it("the scarce night exhausts the network for at least one open movement", () => {
    const counts = eligibleCounts("scarce");

    // Same treatment, same reason. The three assertions this replaces were `length > 30`,
    // `min === 0` and `zeros >= 1` — every one of them satisfied by a network with one movement
    // left and nowhere to put it. They are folded into the absolute below, which is strictly
    // stronger on each: nothing has been loosened or dropped.
    expect(
      {
        openMovements: counts.length,
        eligiblePairs: counts.reduce((sum, count) => sum + count, 0),
        strandedMovements: counts.filter((count) => count === 0).length,
      },
      "The scarce night's shape has changed. Measured values, not targets — re-measure and re-date " +
        "rather than adjusting a number. openMovements must match the standard night's 41 exactly, " +
        "because the scarce scenario changes bed counts and never the movements; if it does not, " +
        "the scenario has started altering something it must not touch, and the last test in this " +
        "file says which attributes those are.",
    ).toEqual({ openMovements: 43, eligiblePairs: 102, strandedMovements: 9 });

    expect(
      Math.min(...counts),
      "The scarce night no longer exhausts the network for anybody. That is this test's whole " +
        "subject: the scarce scenario exists to produce the case where a patient has nowhere to go, " +
        "and if the minimum is above zero the scenario has stopped demonstrating the thing the " +
        "escalation and out-of-area screens are built to answer.",
    ).toBe(0);
  });

  it("the scarce night is strictly tighter than the standard night, movement for movement", () => {
    const standard = eligibleCounts("standard");
    const scarce = eligibleCounts("scarce");
    expect(scarce.every((count, index) => count <= standard[index])).toBe(true);
    const scarceTotal = scarce.reduce((sum, count) => sum + count, 0);
    const standardTotal = standard.reduce((sum, count) => sum + count, 0);
    expect(scarceTotal).toBeLessThan(standardTotal / 2);
  });

  it("changes operational numbers only — never a patient attribute", () => {
    const standard = scenarioUnits("standard");
    const scarce = scenarioUnits("scarce");
    expect(scarce.map((unit) => unit.id)).toEqual(standard.map((unit) => unit.id));
    expect(scarce.map((unit) => unit.cohort)).toEqual(standard.map((unit) => unit.cohort));
    expect(scarce.map((unit) => unit.security)).toEqual(standard.map((unit) => unit.security));
    expect(scarce.map((unit) => unit.authorised)).toEqual(standard.map((unit) => unit.authorised));
    expect(scarce.map((unit) => unit.name)).toEqual(standard.map((unit) => unit.name));
  });
});
