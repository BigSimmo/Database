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
   * Measured directly on 2026-08-25 at NOW_ANCHOR, counting `eligibility(...).eligible` across all
   * 22 units: 41 open movements, 337 eligible movement/unit pairs, distribution
   * {0:2, 4:11, 5:6, 6:3, 11:1, 12:9, 14:9} — and **two movements, WF-009 and WF-308, already have
   * nowhere eligible on the standard night.** Both are the fixture as authored, not something the
   * scarce scenario introduced.
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
