// tests/ward-origin-department-absence.test.ts
//
// `Movement.originEdId` is a REQUIRED string. So an origin id is ALWAYS recorded, and a screen that
// cannot resolve it is looking at a lookup miss, not at a missing record.
//
// ⚠️ THE DEFECT. `ward-management-console.tsx` rendered "No origin department is recorded on this
// movement." — and, fifteen lines from a row repaired earlier the same night, "no origin department
// is recorded". Both reported the wrong absence: they send a reader to look for an unrecorded field
// when what actually happened is that a recorded id matched nothing. Five sibling surfaces already
// rendered the honest form; this file was the sixth and disagreed with all of them, twice.
//
// ⚠️ WHY THIS DRIVES A FUNCTION RATHER THAN RENDERING THE PAGE, STATED BECAUSE IT IS A LIMIT.
// The branch is unreachable through the app's own fixture: every seeded movement's `originEdId`
// resolves, so no rendered page can exercise it. A DOM test would walk the resolved branch on every
// movement and pass against the defect. The wording is therefore driven directly, and the second
// test below pins the premise that makes that necessary — if the fixture ever gains an unresolvable
// movement, that test goes red and this file should grow a rendering assertion.

import { describe, expect, it } from "vitest";

import { unresolvedOriginDepartment } from "../src/components/ward-management/ward-management-console";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";

const departmentIds = new Set(allEmergencyDepartments().map((department) => department.id));

describe("what a ward surface says when an origin department will not resolve", () => {
  it("walks a fixture with movements to reason about at all", () => {
    expect(wardMovements.length, "no seeded movements, so nothing below means anything").toBeGreaterThan(0);
  });

  it("names the id that failed to resolve", () => {
    const movement = { ...wardMovements[0], originEdId: "ed-that-does-not-exist" } as Movement;
    const said = unresolvedOriginDepartment(movement);

    expect(
      said,
      "a reader can only act on this if it tells them WHICH id matched nothing — that is the whole " +
        "difference between a data-entry gap and a broken reference",
    ).toContain("ed-that-does-not-exist");
  });

  it("never claims the origin department was not recorded", () => {
    const movement = { ...wardMovements[0], originEdId: "ed-that-does-not-exist" } as Movement;
    const said = unresolvedOriginDepartment(movement).toLowerCase();

    // The precise falsehood: `originEdId` is required, so something WAS recorded.
    expect(
      said,
      "`Movement.originEdId` is a required string, so an origin id is always recorded; saying it is " +
        "not recorded states the opposite of what the record holds",
    ).not.toContain("is recorded");
    expect(said).not.toContain("not recorded");
    expect(said).not.toContain("none recorded");
  });

  it("says the same thing the five sibling surfaces say", () => {
    // Not a source-text pin: the sentence is reproduced here because five other files render it
    // independently, and the defect was this file disagreeing with them. If the shared wording
    // changes, it must change in all six, and this is the assertion that notices.
    const movement = { ...wardMovements[0], originEdId: "peel-ed-typo" } as Movement;
    expect(unresolvedOriginDepartment(movement)).toBe('No synthetic department matches "peel-ed-typo"');
  });

  /**
   * THE PREMISE, PINNED. The branch above cannot be reached by rendering any seeded movement, which
   * is why the tests drive the function instead. If that stops being true, a rendering test becomes
   * both possible and necessary, and this failure is where somebody finds that out.
   */
  it("has no seeded movement whose origin department fails to resolve", () => {
    const unresolvable = wardMovements.filter((movement) => !departmentIds.has(movement.originEdId));
    expect(
      unresolvable.map((movement) => `${movement.id} -> ${movement.originEdId}`),
      "a seeded movement now reaches the unresolved branch, so this file should assert over the " +
        "rendered page rather than over the helper alone",
    ).toEqual([]);
  });
});
