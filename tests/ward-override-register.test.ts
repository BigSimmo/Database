import { describe, expect, it } from "vitest";

import { allOverrides, overridesAgainstUnit } from "@/components/ward-management/ward-derivations";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement, Override } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;

/**
 * THE COORDINATOR OVERRIDE REGISTER — and the clause that cannot be seen missing.
 *
 * Owner decision OD-3, and the requirement that makes it a governance feature rather than a log:
 * an override is **visible to the party overridden**. The ward that was referred to despite its own
 * gate failing can read that it happened, who decided it, when, and why.
 *
 * ⚠️ **AN AUDIT TRAIL AND AN ACCOUNTABILITY RECORD STORE IDENTICAL DATA.** The difference is who
 * can read it — a permission, not a schema — so a reviewer reading `Override` in `ward-model.ts`
 * sees nothing missing whichever one was built. **That is why this file exists and why the
 * assertions below are about what a ward-scoped read RETURNS and, more importantly, what it does
 * not.** An override register that only its author can see is a trail, and the decision was
 * explicitly that it is not one.
 *
 * The failure this guards against is not malice. It is the natural implementation: pass the whole
 * register to the ward screen and filter it at render. That looks identical in review, passes any
 * test asserting the ward sees its own overrides, and leaks every other ward's the moment somebody
 * adds a column, a debug panel, or a styling change that reveals a hidden row.
 */
function overrideOn(unitIds: string[], reason: Override["reason"] = OVERRIDE_REASONS[0]): Override {
  return { at: NOW, by: "Flow coordinator", reason, unitIds };
}

function movementWithOverrides(id: string, overrides: Override[]): Movement {
  const base = seedWardFlowState().movements[0];
  return { ...base, id, overrides };
}

describe("the override register is scoped to the ward it was made against", () => {
  const AGAINST_RPH = overrideOn(["rph-adult-secure"], "Clinical urgency outweighs the mismatch");
  const AGAINST_SCGH = overrideOn(["scgh-adult-open"], "The bed information is known to be out of date");
  const AGAINST_BOTH = overrideOn(["rph-adult-secure", "scgh-adult-open"]);

  const movements = [
    movementWithOverrides("WF-A", [AGAINST_RPH]),
    movementWithOverrides("WF-B", [AGAINST_SCGH]),
    movementWithOverrides("WF-C", [AGAINST_BOTH]),
    movementWithOverrides("WF-D", []),
  ];

  it("has overrides against more than one ward, or the boundary below proves nothing", () => {
    // The canary. Every assertion after this passes trivially against a register holding overrides
    // against a single ward, or none.
    const all = allOverrides(movements);
    expect(all.length).toBe(3);
    const wards = new Set(all.flatMap((entry) => entry.override.unitIds));
    expect(wards.size, "the fixture must span at least two wards").toBeGreaterThan(1);
  });

  it("shows a ward the overrides made against it", () => {
    const rph = overridesAgainstUnit(movements, "rph-adult-secure");
    expect(rph.map((entry) => entry.movement.id).sort()).toEqual(["WF-A", "WF-C"]);
    expect(rph.map((entry) => entry.override.reason)).toContain("Clinical urgency outweighs the mismatch");
  });

  it("NEVER RETURNS AN OVERRIDE MADE AGAINST A DIFFERENT WARD — the boundary", () => {
    const rph = overridesAgainstUnit(movements, "rph-adult-secure");
    for (const entry of rph) {
      expect(
        entry.override.unitIds,
        `a ward-scoped read for rph-adult-secure returned an override that does not name it. The ` +
          `register is an accountability record, not a log with a filter on the screen: what a ward ` +
          `cannot see must not reach it, because a filter applied at render is undone by the next ` +
          `column, debug panel or styling change.`,
      ).toContain("rph-adult-secure");
    }

    // Stated the other way round too, because "every returned row names me" is satisfied by
    // returning nothing at all, and by returning only the rows that happen to be first.
    const scghOnly = allOverrides(movements).filter((entry) => !entry.override.unitIds.includes("rph-adult-secure"));
    expect(scghOnly.length, "there must be an override rph is not entitled to see").toBeGreaterThan(0);
    for (const hidden of scghOnly) {
      expect(
        rph.some((entry) => entry.movement.id === hidden.movement.id && entry.override === hidden.override),
        `${hidden.movement.id}'s override was made against another ward and reached rph-adult-secure`,
      ).toBe(false);
    }
  });

  it("gives the coordinator the whole register, which is what makes the ward scope a restriction", () => {
    // If both reads returned the same thing, the scoping would be decorative.
    expect(allOverrides(movements).length).toBeGreaterThan(overridesAgainstUnit(movements, "rph-adult-secure").length);
  });

  it("carries who decided, when, and why — not merely that something happened", () => {
    const [entry] = overridesAgainstUnit(movements, "scgh-adult-open");
    expect(entry.override.by, "a ROLE, never a person").toBe("Flow coordinator");
    expect(entry.override.at).toBe(NOW);
    expect(OVERRIDE_REASONS, "the reason must come from the fixed list").toContain(entry.override.reason);
  });
});

describe("an override reason survives the event that carried it", () => {
  /**
   * The storage half of OD-3. Before this, `handleOverrideSubmit` dispatched `REFER_TO_UNITS` —
   * which carried no reason at all — and kept the text in the panel's own `useState`, where the
   * next patient selection cleared it. Replacing the textarea with a fixed list alone would have
   * swapped free text that goes nowhere for five reasons that go nowhere.
   */
  function referableMovement() {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.stage === "placement_requested");
    if (!movement) throw new Error("fixture has no referable movement");
    return { state, movement };
  }

  it("keeps the reason on the movement when one is given", () => {
    const { state, movement } = referableMovement();
    const after = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: movement.id,
      unitIds: ["rph-adult-secure"],
      overrideReason: "Closer to the person's home or family",
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.overrides).toHaveLength(1);
    expect(updated.overrides[0]).toMatchObject({
      at: NOW,
      by: "Flow coordinator",
      reason: "Closer to the person's home or family",
      unitIds: ["rph-adult-secure"],
    });
  });

  it("records NOTHING when no reason is given, because most referrals are not overrides", () => {
    const { state, movement } = referableMovement();
    const after = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: movement.id,
      unitIds: ["rph-adult-secure"],
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.overrides, "an ordinary referral must not appear in the override register").toEqual([]);
  });

  it("refuses a reason outside the list, by membership rather than truthiness", () => {
    const { state, movement } = referableMovement();
    const after = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: movement.id,
      unitIds: ["rph-adult-secure"],
      // A plausible sentence that is not on the owner's list. Free text returning through the back
      // door is exactly what WB-DB-16 forbids.
      overrideReason: "Ward manager agreed on the phone" as never,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("OVERRIDE_REASONS");
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.overrides).toEqual([]);
  });
});
