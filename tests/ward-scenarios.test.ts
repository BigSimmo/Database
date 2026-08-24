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
  it("the standard night leaves every open movement several eligible wards", () => {
    const counts = eligibleCounts("standard");
    expect(counts.length).toBeGreaterThan(30);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
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
