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
    expect(counts.length).toBeGreaterThan(30);
    // Non-vacuity floor: the standard night must stay a night with genuine choice on it, so this
    // goes red if the fixture or the gates ever degrade it toward the scarce night.
    expect(counts.reduce((sum, count) => sum + count, 0)).toBeGreaterThan(300);
    // ...but it is NOT a night on which everyone has somewhere to go, and the escalation board
    // exists partly because of these two. Pinned exactly, so a regression that strands more
    // patients fails here rather than passing quietly.
    expect(counts.filter((count) => count === 0)).toHaveLength(2);
  });

  it("the scarce night exhausts the network for at least one open movement", () => {
    const counts = eligibleCounts("scarce");
    expect(counts.length).toBeGreaterThan(30);
    expect(Math.min(...counts)).toBe(0);
    expect(counts.filter((count) => count === 0).length).toBeGreaterThanOrEqual(1);
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
