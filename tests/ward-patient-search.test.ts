// tests/ward-patient-search.test.ts
import { describe, expect, it } from "vitest";

import { isOpen, searchMovements } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";

const { movements, units } = seedWardFlowState();
const openIds = movements
  .filter(isOpen)
  .map((movement) => movement.id)
  .sort();

describe("searchMovements", () => {
  it("returns every open movement for an empty query, and nothing closed", () => {
    const result = searchMovements(movements, units, { text: "" });
    expect(result.map((movement) => movement.id).sort()).toEqual(openIds);
  });

  it("returns every open movement for a whitespace-only query", () => {
    const result = searchMovements(movements, units, { text: "   " });
    expect(result.map((movement) => movement.id).sort()).toEqual(openIds);
  });

  // Measured directly against the real fixture at NOW_ANCHOR (2026-08-25): WF-003 is the only
  // 3-digit movement id containing "wf-003" as a substring, so this is exact by construction, not
  // by luck. Uppercase-vs-lowercase both sides proves the match is case-insensitive.
  it("matches on movement id, case-insensitively", () => {
    const result = searchMovements(movements, units, { text: "wf-003" });
    expect(result.map((movement) => movement.id)).toEqual(["WF-003"]);
  });

  // Measured: exactly four OPEN movements carry originEdId "arm-ed" — WF-001, WF-011, WF-315,
  // WF-323 (a fifth, WF-307, also has "arm-ed" but is closed and must be excluded — see the
  // dedicated "never returns a closed movement" test below for that exclusion asserted directly).
  it("matches on originEdId, case-insensitively", () => {
    const result = searchMovements(movements, units, { text: "ARM-ED" });
    expect(result.map((movement) => movement.id).sort()).toEqual(["WF-001", "WF-011", "WF-315", "WF-323"]);
  });

  // Measured: WF-003 and WF-014 are the only OPEN movements whose resolved destination unit is
  // "rph-adult-secure" (RPH Adult Secure). The query text here is the hyphenated unit ID, which
  // does not appear anywhere in the unit's own display name ("RPH Adult Secure" uses spaces, not
  // hyphens) — so a match here can only have come from `destinationUnit(...).id`, not `.name`.
  it("matches on the resolved destination unit's id", () => {
    const result = searchMovements(movements, units, { text: "rph-adult-secure" });
    expect(result.map((movement) => movement.id).sort()).toEqual(["WF-003", "WF-014"]);
  });

  // Same two movements, but the query text here is the space-separated display name. That string
  // does not appear anywhere in the unit's own hyphenated id ("rph-adult-secure" has no spaces),
  // and it does not appear in either movement's originEdId, stage label, or owner either — so a
  // match here can only have come from `destinationUnit(...).name`, not `.id`.
  it("matches on the resolved destination unit's name", () => {
    const result = searchMovements(movements, units, { text: "RPH Adult Secure" });
    expect(result.map((movement) => movement.id).sort()).toEqual(["WF-003", "WF-014"]);
  });

  // Measured: exactly seven OPEN movements sit in "bed_held" — WF-004, WF-011, WF-016, WF-304,
  // WF-311, WF-318, WF-325. The query text is the human-readable stage LABEL ("Bed held"), not the
  // raw enum value — searching the raw enum "bed_held" (with the underscore) matches nothing,
  // proving the match is against `stageCopy[...].label` (what the results table actually shows),
  // not the internal MovementStage string.
  it("matches on the stage's display label, not the raw enum value", () => {
    const byLabel = searchMovements(movements, units, { text: "Bed held" });
    expect(byLabel.map((movement) => movement.id).sort()).toEqual([
      "WF-004",
      "WF-011",
      "WF-016",
      "WF-304",
      "WF-311",
      "WF-318",
      "WF-325",
    ]);

    const byRawEnum = searchMovements(movements, units, { text: "bed_held" });
    expect(byRawEnum).toEqual([]);
  });

  // Measured: WF-015 is the only OPEN movement whose owner is "Ward nurse in charge". Mixed case
  // proves case-insensitivity on this field too.
  it("matches on owner, case-insensitively", () => {
    const result = searchMovements(movements, units, { text: "ward NURSE in charge" });
    expect(result.map((movement) => movement.id)).toEqual(["WF-015"]);
  });

  it("the stage filter is an exact match, not a substring match", () => {
    const result = searchMovements(movements, units, { text: "", stage: "bed_held" });
    expect(result.map((movement) => movement.id).sort()).toEqual([
      "WF-004",
      "WF-011",
      "WF-016",
      "WF-304",
      "WF-311",
      "WF-318",
      "WF-325",
    ]);
    expect(result.every((movement) => movement.stage === "bed_held")).toBe(true);
  });

  it("the department (edId) filter is an exact match", () => {
    const result = searchMovements(movements, units, { text: "", edId: "arm-ed" });
    expect(result.map((movement) => movement.id).sort()).toEqual(["WF-001", "WF-011", "WF-315", "WF-323"]);
    expect(result.every((movement) => movement.originEdId === "arm-ed")).toBe(true);
  });

  // stage, edId and text all narrow the same result set together (AND, not OR). WF-011 is the one
  // OPEN movement at "arm-ed" that also sits in "bed_held" — measured against the two filters
  // above, whose sets intersect at exactly this one id.
  it("stage, department and text filters combine (AND), not replace one another", () => {
    const result = searchMovements(movements, units, { text: "", stage: "bed_held", edId: "arm-ed" });
    expect(result.map((movement) => movement.id)).toEqual(["WF-011"]);
  });

  // THE ABSOLUTE RULE. WF-007 is closed (`closure.outcome: "arrived"`, `stage: "arrived"`) and
  // WF-008 is closed via `closure` alone while still recording `stage: "accepted_awaiting_bed"` —
  // the exact case `isOpen`'s own doc comment calls out, where `closure` and `stage === "arrived"`
  // must be checked independently. Both are asserted directly: searching each one's own id,
  // verbatim, must return nothing, proving a closed movement can never surface in search results
  // even when every other field of the query would otherwise match it perfectly.
  it("never returns a closed movement, even when the query is the closed movement's own id", () => {
    const closedArrived = movements.find((movement) => movement.id === "WF-007");
    const closedViaClosureOnly = movements.find((movement) => movement.id === "WF-008");
    if (!closedArrived || !closedViaClosureOnly) {
      throw new Error("fixture no longer carries WF-007/WF-008 — update this test's closed-movement cases");
    }
    expect(isOpen(closedArrived)).toBe(false);
    expect(isOpen(closedViaClosureOnly)).toBe(false);

    expect(searchMovements(movements, units, { text: "wf-007" })).toEqual([]);
    expect(searchMovements(movements, units, { text: "wf-008" })).toEqual([]);

    // And neither appears in the unfiltered (empty-query) result set either.
    const all = searchMovements(movements, units, { text: "" });
    expect(all.map((movement) => movement.id)).not.toContain("WF-007");
    expect(all.map((movement) => movement.id)).not.toContain("WF-008");
  });

  // Same absolute rule, constructed rather than relying on a fixture id staying closed forever:
  // an otherwise-fully-matching open movement, cloned and closed, must drop out of a query that
  // still matches every one of its other fields exactly.
  it("never returns a closed movement — constructed case, every non-closure field still matches", () => {
    const base = movements.find((movement) => movement.id === "WF-011");
    if (!base) throw new Error("fixture no longer carries WF-011 to build the closed clone from");
    expect(isOpen(base)).toBe(true);

    const closedClone = {
      ...base,
      id: "WF-TEST-CLOSED-CLONE",
      closure: { at: base.openedAt, outcome: "arrived" as const, reason: "Test fixture: arrived" },
    };
    expect(isOpen(closedClone)).toBe(false);

    const withClone = [...movements, closedClone];
    const byId = searchMovements(withClone, units, { text: "WF-TEST-CLOSED-CLONE" });
    expect(byId).toEqual([]);

    const byStageAndEd = searchMovements(withClone, units, { text: "", stage: "bed_held", edId: "arm-ed" });
    expect(byStageAndEd.map((movement) => movement.id)).not.toContain("WF-TEST-CLOSED-CLONE");
  });
});
