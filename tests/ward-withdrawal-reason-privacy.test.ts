import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { WITHDRAWAL_REASONS, withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 A WARD IS NEVER TOLD WHERE THE PATIENT WENT — `FD-23`, and it was being told in plain English.
 *
 * When one ward accepts, every other ward's referral is withdrawn and a `withdrawnReferrals` entry
 * records it. The reason read:
 *
 *     reason: `withdrawn — placed at ${acceptedUnit.name}`
 *
 * and the ward page renders `entry.reason` verbatim. So on the seeded fixture, at
 * `/mockups/ward-flow/ward/fsh-adult-secure`, FSH was told **"Referral withdrawn once RGH Adult
 * Secure confirmed the bed"** — the losing ward, reading the winner's name, out of the very field
 * that exists to record its own loss. Two sessions found it independently and both confirmed it on
 * screen rather than inferring it.
 *
 * ⚠️ **AND NO SHAPE GUARD COULD SEE IT.** `ward-referral-visibility.ts` holds a mutation-tested
 * field-set allowlist at every level and this passes every one: `reason` is a **permitted field of
 * a permitted type carrying a forbidden value.** A guard over shapes cannot see a fact smuggled in
 * prose — the same blindness that let `ALLOWED_DESTINATION_FIELDS` pass while inspecting nothing.
 *
 * ⚠️ **SO THE FIX IS NOT A BETTER SENTENCE.** Sanitising the string leaves a free-form `string` that
 * any future edit can refill, with nothing red to say so. Every other reason in this model is a
 * member of a fixed list; this one was a bare `string`. It is now a union, which makes the leak
 * **unrepresentable** rather than merely absent — the same move as `edId` resolving against the real
 * network instead of being checked for non-emptiness.
 *
 * The coordinator loses nothing: it may see `movement.acceptedUnitId` directly, because it is
 * allowed to. The destination stops travelling inside a ward-readable string.
 */
const REDUCER_PATH = fileURLToPath(new URL("../src/components/ward-management/ward-flow-reducer.ts", import.meta.url));
const ACCEPTING_UNIT = "fre-adult-open";
const OTHER_UNIT = "rph-adult-secure";

describe("a withdrawal reason cannot name the ward that won", () => {
  it("offers reasons as a fixed list, not free text", () => {
    expect(WITHDRAWAL_REASONS.length).toBeGreaterThan(0);
    for (const reason of WITHDRAWAL_REASONS) {
      expect(reason, "a reason must be a code, never a sentence").toMatch(/^[a-z_]+$/);
    }
  });

  it("⚠️ NAMES NO UNIT IN ANY REASON OR LABEL — checked against every real ward, not a sample", () => {
    // The whole live unit list rather than the two in this file, so a ward added later is covered
    // without anybody remembering to extend this.
    const units = allUnits();
    expect(units.length, "there must be real wards to check against").toBeGreaterThan(1);

    for (const unit of units) {
      for (const reason of WITHDRAWAL_REASONS) {
        expect(reason).not.toContain(unit.name);
        expect(
          withdrawalReasonLabels[reason],
          `the label for "${reason}" names ${unit.name}. FD-23: a ward may know its referral ended ` +
            "and when. It may not know where the patient went — and a losing ward that can see the " +
            "winner is exactly what this field is supposed to protect it from.",
        ).not.toContain(unit.name);
      }
    }
  });

  it("⚠️ ASSERTS NO MOVEMENT — the SECOND defect in that string, which survived the first fix", () => {
    // The original read `withdrawn — placed at ${acceptedUnit.name}`. Removing the name leaves
    // "placed", and "placed" is FALSE: `ACCEPT_IN_PRINCIPLE` leaves the movement at
    // `accepted_awaiting_bed`, so the patient is accepted and has not moved. Two sessions drafted a
    // sanitised "the patient was placed" independently and one caught it — each of us checked the
    // string for the leak we were hunting and not for whether it was true.
    //
    // So this is a vocabulary pin, not a style preference: every word below asserts a completed
    // transfer, or a consequence of one, that this event has not produced.
    const assertsAMove = ["placed", "moved", "transferred", "admitted", "arrived", "bed is free", "discharged"];
    for (const reason of WITHDRAWAL_REASONS) {
      const label = withdrawalReasonLabels[reason].toLowerCase();
      for (const word of assertsAMove) {
        expect(
          label,
          `the label for "${reason}" says "${word}", which claims the patient has moved. Acceptance ` +
            "is not placement — the movement is still at accepted_awaiting_bed and the bed is not yet used.",
        ).not.toContain(word);
        expect(reason).not.toContain(word.replace(/ /g, "_"));
      }
    }
  });

  it("⚠️ HAS EXACTLY ONE WITHDRAWAL WRITER, because the label is only CONDITIONALLY true", () => {
    // "Another unit accepted this patient" is true of every entry that can exist TODAY, and only
    // because acceptance is the sole cause of a withdrawal. A second withdrawal path with a
    // different cause — a coordinator retraction, a referral timing out — makes the label quietly
    // wrong on a ward screen, and nothing else in this repository would notice.
    //
    // Measured on the source rather than assumed, because the claim IS a claim about the source.
    const source = readFileSync(REDUCER_PATH, "utf8");
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Both directions, because either failure makes the count below meaningless. The floor is a
    // quarter rather than a half: MEASURED, this file is a little over half comment by character,
    // and a canary that assumes otherwise fails on a healthy file — which is how this one first
    // went red.
    expect(stripped.length, "the comment stripper ate the file, so the count below means nothing").toBeGreaterThan(
      source.length / 4,
    );
    expect(stripped, "the stripper removed the code as well as the comments").toContain("ACCEPT_IN_PRINCIPLE");
    expect(stripped, "the stripper removed nothing, so a commented-out write would still be counted").not.toContain(
      "FD-23",
    );

    const writes = stripped.match(/withdrawnReferrals:/g) ?? [];
    expect(
      writes.length,
      "a new write to withdrawnReferrals appeared. If it records a DIFFERENT cause then " +
        '"another_unit_accepted" is no longer true of every entry: add a member to WITHDRAWAL_REASONS ' +
        "for it rather than reusing this one, and update this count.",
    ).toBe(2);
    expect(stripped, "one of the two writes is the empty initialisation, which records no cause").toContain(
      "withdrawnReferrals: []",
    );
  });

  it("uses the ward page's wording verbatim, so the record and the screen cannot drift", () => {
    // The ward board renders this sentence on its own branch and settled the wording there. Pinned
    // here so a change on either side is a visible decision rather than two surfaces disagreeing
    // about what a withdrawal means.
    expect(withdrawalReasonLabels.another_unit_accepted).toBe("Withdrawn — another unit accepted this patient.");
  });

  it("gives every reason a label, so no screen renders a raw code", () => {
    expect(Object.keys(withdrawalReasonLabels).sort()).toEqual([...WITHDRAWAL_REASONS].sort());
    for (const reason of WITHDRAWAL_REASONS) {
      expect(withdrawalReasonLabels[reason].length).toBeGreaterThan(0);
      expect(withdrawalReasonLabels[reason], "a label is a sentence, not the code again").not.toBe(reason);
    }
  });

  it("⚠️ WRITES A CODE ON A REAL ACCEPTANCE — the path that produced the leak", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.stage === "placement_requested");
    expect(movement, "the fixture must hold a referable movement").toBeDefined();

    let state = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement!.id,
      unitIds: [ACCEPTING_UNIT, OTHER_UNIT],
    } as never);
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement!.id,
      unitId: ACCEPTING_UNIT,
    } as never);
    expect(state.rejections, "the walk must be accepted, or nothing below is exercised").toEqual([]);

    const after = state.movements.find((candidate) => candidate.id === movement!.id)!;
    const withdrawn = after.withdrawnReferrals.filter((entry) => entry.unitId === OTHER_UNIT);
    expect(
      withdrawn.length,
      "the losing ward must have a withdrawal entry, or this test observed nothing",
    ).toBeGreaterThan(0);

    const accepting = allUnits().find((unit) => unit.id === ACCEPTING_UNIT)!;
    for (const entry of withdrawn) {
      expect(WITHDRAWAL_REASONS).toContain(entry.reason);
      expect(
        entry.reason,
        `the withdrawal written for ${OTHER_UNIT} names ${accepting.name}, the ward that won`,
      ).not.toContain(accepting.name);
    }
  });

  it("⚠️ AND THE SEED CARRIES NONE EITHER — the leak was hand-authored as well as generated", () => {
    // Ward Board found it on screen at fsh-adult-secure from a seeded string, not a dispatched one.
    // Fixing only the reducer would have left the demonstration leaking.
    const units = allUnits();
    for (const movement of seedWardFlowState().movements) {
      for (const entry of movement.withdrawnReferrals) {
        expect(WITHDRAWAL_REASONS, `${movement.id} carries a free-text withdrawal reason`).toContain(entry.reason);
        for (const unit of units) {
          expect(entry.reason, `${movement.id}'s withdrawal names ${unit.name}`).not.toContain(unit.name);
        }
      }
    }
  });

  it("has a seeded withdrawal at all, or the assertion above passes over an empty list", () => {
    // The canary. `for (const entry of [])` satisfies every assertion inside it.
    const withdrawals = seedWardFlowState().movements.flatMap((movement) => movement.withdrawnReferrals);
    expect(withdrawals.length).toBeGreaterThan(0);
  });
});
