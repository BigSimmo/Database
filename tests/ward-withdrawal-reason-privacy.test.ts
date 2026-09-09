import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { WITHDRAWAL_REASONS, withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { namesRealPlace } from "./helpers/ward-place-names";

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

/**
 * ⚠️ **THIS GAP WAS LATENT, NOT LIVE.** Every check below this point historically covered only
 * `allUnits()` — a withdrawal reason was checked against every unit name, but never against a
 * site name, a site code, or an emergency-department name. `WITHDRAWAL_REASONS` is a closed
 * two-member union with two hardcoded labels and zero string interpolation, so nothing today can
 * actually produce a reason naming a site or ED — this widens the guard against a FUTURE edit
 * (a templated or free-text reason), the same way the unit check already stood watch before this
 * file existed. Do not read a red result here as an active leak; read it as the tripwire firing.
 *
 * The forbidden set is built from the live registers in `ward-sites.ts` — never hand-typed — so a
 * site or unit added later is covered automatically without anyone remembering to extend a list.
 */
function forbiddenPlaceNames(): {
  units: string[];
  siteNames: string[];
  siteCodes: string[];
  edNames: string[];
  all: string[];
} {
  const units = allUnits().map((unit) => unit.name);
  const siteNames = wardSites.map((site) => site.name);
  const siteCodes = wardSites.map((site) => site.code);
  const edNames = allEmergencyDepartments().map((ed) => ed.name);
  return { units, siteNames, siteCodes, edNames, all: [...units, ...siteNames, ...siteCodes, ...edNames] };
}

describe("the leak detector itself, proved before it is trusted against real reasons", () => {
  // The type system forbids constructing a leaking WithdrawalReason, so the detector — not the
  // data — is what must be proved. Each case below is synthetic: a string shaped like a reason,
  // built to fail, fed straight to the function that will later be trusted against real values.

  it("fires on a synthetic reason naming a real site name", () => {
    const site = wardSites[0];
    const synthetic = `Withdrawn — a bed was confirmed at ${site.name}.`;
    expect(namesRealPlace(synthetic, site.name), `did not fire on the site name "${site.name}"`).toBe(true);
  });

  it("fires on a synthetic reason naming a real site code", () => {
    const site = wardSites[0];
    const synthetic = `Withdrawn — bed confirmed at site ${site.code}.`;
    expect(namesRealPlace(synthetic, site.code), `did not fire on the site code "${site.code}"`).toBe(true);
  });

  it("fires on a synthetic reason naming a real emergency department", () => {
    const ed = allEmergencyDepartments()[0];
    const synthetic = `Withdrawn — the patient was redirected to ${ed.name}.`;
    expect(namesRealPlace(synthetic, ed.name), `did not fire on the ED name "${ed.name}"`).toBe(true);
  });

  /**
   * ⚠️ THE REGRESSION, AND IT IS NOT HYPOTHETICAL. The three cases above all end the place name with
   * a full stop or a space, so a word boundary always exists after it and a `\b…\b` detector passes
   * them. **That is what made this flaw survivable here and invisible everywhere.**
   *
   * The identical helper in `ward-screen-fd23-leaks.dom.test.tsx` was written with a bare `\b…\b`
   * for every name, and against a real DOM `textContent` — where siblings concatenate with no
   * separator — it could not fire. The master line ran that version for part of 2026-09-02.
   *
   * This file's own callers pass standalone labels, so the seam cannot be reached from here today.
   * **It is pinned anyway, because the next caller to pass rendered text would inherit a guard that
   * cannot fire and nothing in the signature would warn them.**
   */
  it("fires on a multi-word place butted against the next element's text — no boundary exists there", () => {
    const ed = allEmergencyDepartments()[0];
    const concatenated = `${ed.name}WF-013Older adult · Open`;

    expect(
      /\w/.test(concatenated.charAt(ed.name.length)),
      "this case is only meaningful while the character after the place name is a word character",
    ).toBe(true);

    expect(
      namesRealPlace(concatenated, ed.name),
      "a multi-word place name with no separator after it is still a leak, and a \\b detector misses it",
    ).toBe(true);
  });

  it("still refuses to match a short code buried inside an ordinary word", () => {
    const shortCode = wardSites.map((site) => site.code).find((code) => !code.includes(" ") && code.length <= 4);
    expect(shortCode, "no single-token site code is registered, so the boundary rule is untested").toBeDefined();
    if (shortCode === undefined) return;

    // Both directions, or this proves only that the detector is silent rather than that it discriminates.
    expect(namesRealPlace(`the ward was ${shortCode.toLowerCase()}ing quietly`, shortCode)).toBe(false);
    expect(namesRealPlace(`Withdrawn — bed confirmed at ${shortCode} today.`, shortCode)).toBe(true);
  });

  it("stays silent on the real WITHDRAWAL_REASONS labels — the control, or the detector flags everything", () => {
    const { all } = forbiddenPlaceNames();
    expect(all.length, "forbidden-name set size drifted from the registers it is built from").toBe(65);

    for (const reason of WITHDRAWAL_REASONS) {
      for (const name of all) {
        expect.soft(namesRealPlace(reason, name), `the reason code "${reason}" falsely matched "${name}"`).toBe(false);
        expect
          .soft(
            namesRealPlace(withdrawalReasonLabels[reason], name),
            `the label for "${reason}" falsely matched "${name}"`,
          )
          .toBe(false);
      }
    }
  });
});

describe("a withdrawal reason cannot name the ward that won", () => {
  it("offers reasons as a fixed list, not free text", () => {
    expect(WITHDRAWAL_REASONS.length).toBeGreaterThan(0);
    for (const reason of WITHDRAWAL_REASONS) {
      expect(reason, "a reason must be a code, never a sentence").toMatch(/^[a-z_]+$/);
    }
  });

  it("⚠️ NAMES NO UNIT, SITE, OR EMERGENCY DEPARTMENT IN ANY REASON OR LABEL — checked against every real place, not a sample", () => {
    // The whole live registers rather than a hand-picked subset, so a place added later is
    // covered without anybody remembering to extend this. Site NAMES and site CODES are both
    // checked — a code is exactly as identifying once memorised ("the RGH bed") as the full name.
    const { units, siteNames, siteCodes, edNames, all } = forbiddenPlaceNames();
    expect(units.length, "unit register size drifted").toBe(23);
    expect(siteNames.length, "site register size drifted").toBe(17);
    expect(siteCodes.length, "site-code register size drifted").toBe(17);
    expect(edNames.length, "emergency-department register size drifted").toBe(8);
    expect(all.length, "forbidden-name set size drifted from the registers it is built from").toBe(65);

    for (const reason of WITHDRAWAL_REASONS) {
      for (const place of all) {
        expect.soft(namesRealPlace(reason, place), `the reason code "${reason}" names "${place}"`).toBe(false);
        expect
          .soft(
            namesRealPlace(withdrawalReasonLabels[reason], place),
            `the label for "${reason}" names ${place}. FD-23: a ward may know its referral ended and when. It ` +
              "may not know where the patient went — and a losing ward that can see the winner, its site, or " +
              "the emergency department that fed it is exactly what this field is supposed to protect it from.",
          )
          .toBe(false);
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
    /*
     * ⚠️ **RAISED FROM 2 TO 3 ON 2026-09-01, AND THIS CANARY WORKED EXACTLY AS WRITTEN.** Its own
     * message said that a new write recording a DIFFERENT cause means "another_unit_accepted" is no
     * longer true of every entry, and that the answer is a new member of WITHDRAWAL_REASONS rather
     * than reuse of this one. `WITHDRAW_REFERRAL` is that write and `referrer_withdrew` is that
     * member — so the count moves because the instruction was followed, not to silence a red.
     *
     * The three writes are now: the empty initialisation, which records no cause; ACCEPT_IN_PRINCIPLE
     * withdrawing the losing units; and WITHDRAW_REFERRAL withdrawing all of them at the referrer's
     * own request. Every one of the two real causes has its own code.
     */
    expect(
      writes.length,
      "a new write to withdrawnReferrals appeared. If it records a DIFFERENT cause then the existing " +
        "reason codes are no longer true of every entry: add a member to WITHDRAWAL_REASONS for it " +
        "rather than reusing one, and update this count.",
    ).toBe(3);
    expect(stripped, "one of the three writes is the empty initialisation, which records no cause").toContain(
      "withdrawnReferrals: []",
    );
    // The two real causes are distinguishable in the source, so a future edit cannot collapse them
    // back onto one code without this going red as well as the count.
    expect(stripped, "the referrer's own withdrawal no longer carries its own cause").toContain("referrer_withdrew");
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
      "the losing ward must have exactly one withdrawal entry, or this test observed the wrong thing",
    ).toBe(1);

    const accepting = allUnits().find((unit) => unit.id === ACCEPTING_UNIT)!;
    const acceptingSite = wardSites.find((site) => site.code === accepting.siteCode)!;
    // Fremantle runs no ED of its own (confirmed against the data, not assumed — see `ward-sites.ts`),
    // so the forbidden set for THIS accepting unit has no ED entry. A future accepting unit whose
    // site does have one is still covered by the register-wide sweep above; this test is a second,
    // narrower witness on the exact write path that produced FD-23.
    expect(
      acceptingSite.emergencyDepartment,
      "Fremantle grew an ED — extend the forbidden set below to include its name",
    ).toBeUndefined();
    const forbiddenForAccepting = [accepting.name, acceptingSite.name, acceptingSite.code];
    expect(forbiddenForAccepting.length, "the forbidden-name set for the accepting unit drifted").toBe(3);

    for (const entry of withdrawn) {
      expect
        .soft(WITHDRAWAL_REASONS, `${OTHER_UNIT}'s withdrawal reason is not a recognised code`)
        .toContain(entry.reason);
      for (const name of forbiddenForAccepting) {
        expect
          .soft(
            namesRealPlace(entry.reason, name),
            `the withdrawal written for ${OTHER_UNIT} names "${name}" — part of ${accepting.name}/${acceptingSite.name}, the ward that won`,
          )
          .toBe(false);
      }
    }
  });

  it("⚠️ AND THE SEED CARRIES NONE EITHER — the leak was hand-authored as well as generated", () => {
    // Ward Board found it on screen at fsh-adult-secure from a seeded string, not a dispatched one.
    // Fixing only the reducer would have left the demonstration leaking.
    const { all } = forbiddenPlaceNames();
    expect(all.length, "forbidden-name set size drifted from the registers it is built from").toBe(65);

    const withdrawals = seedWardFlowState().movements.flatMap((movement) =>
      movement.withdrawnReferrals.map((entry) => ({ movementId: movement.id, entry })),
    );
    expect(withdrawals.length, "the seed's withdrawal count drifted — update this pin deliberately").toBe(1);

    for (const { movementId, entry } of withdrawals) {
      expect.soft(WITHDRAWAL_REASONS, `${movementId} carries a free-text withdrawal reason`).toContain(entry.reason);
      for (const name of all) {
        expect
          .soft(namesRealPlace(entry.reason, name), `${movementId}'s withdrawal reason names "${name}"`)
          .toBe(false);
      }
    }
  });

  it("has a seeded withdrawal at all, or the assertion above passes over an empty list", () => {
    // The canary. `for (const entry of [])` satisfies every assertion inside it.
    const withdrawals = seedWardFlowState().movements.flatMap((movement) => movement.withdrawnReferrals);
    expect(withdrawals.length).toBeGreaterThan(0);
  });
});
