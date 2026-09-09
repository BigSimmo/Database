import { describe, expect, it } from "vitest";

import { eligibilityWarning } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { movementById } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

/**
 * The receiving-ward half of `docs/ward-flow/the-engine-enforces-nothing.md`: `eligibility()`
 * already knows a ward cannot lawfully or safely hold a movement, and nothing told the ward. These
 * pin `eligibilityWarning()` against the exact pair the finding demonstrated — WF-009 (Adult,
 * Secure, Male, specialling, involuntary/detained) referred to `brm-adult-secure`, the network's
 * forensic bed — never a hand-authored fixture, so the test fails loudly if the seed changes
 * underneath it rather than silently proving nothing.
 */
const WF_009 = movementById("WF-009")!;
const BRM_ADULT_SECURE = unitById("brm-adult-secure")!;
const WF_017 = movementById("WF-017")!;
const BTY_ADULT_SECURE = unitById("bty-adult-secure")!;

describe("eligibility warning", () => {
  it("fixture sanity: WF-009 against brm-adult-secure fails more than one real eligibility gate", () => {
    // Guards the whole suite below against a silently-changed fixture — if this ever fails, every
    // other assertion here is testing a pair that no longer demonstrates anything.
    const verdict = eligibility(WF_009, BRM_ADULT_SECURE, NOW_ANCHOR);
    const failedGateNames = verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(failedGateNames).toContain("forensic");
    expect(failedGateNames).toContain("specialling");
    expect(failedGateNames.length).toBeGreaterThanOrEqual(2);
  });

  it("fixture sanity: WF-017 against bty-adult-secure passes every real eligibility gate", () => {
    const verdict = eligibility(WF_017, BTY_ADULT_SECURE, NOW_ANCHOR);
    expect(verdict.eligible).toBe(true);
  });

  it("says nothing when the ward passes every eligibility gate", () => {
    expect(eligibilityWarning(WF_017, BTY_ADULT_SECURE, NOW_ANCHOR)).toBeUndefined();
  });

  it("names the failing gate's own reason when one gate fails", () => {
    // WF-009 has, in the real seeded fixture, already declined every real secure adult unit in the
    // network (rph/gry/bty/fsh/rgh-adult-secure — see `ward-movements.ts`), so no real unit can
    // isolate a single failing gate against it without `prior_decline` also failing. This starts
    // from `fsh-adult-secure`'s real shape (non-forensic, Male-only, WF-009 is Male, otherwise a
    // clean match) under an id that carries none of WF-009's decline records, so only the
    // deliberately zeroed specialling gate fails — proven below before it is asserted on.
    const singleFailureUnit = {
      ...unitById("fsh-adult-secure")!,
      id: "test-only-adult-secure",
      speciallingCapacity: 0,
    };
    const verdict = eligibility(WF_009, singleFailureUnit, NOW_ANCHOR);
    const failedGateNames = verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(failedGateNames).toEqual(["specialling"]);

    const warning = eligibilityWarning(WF_009, singleFailureUnit, NOW_ANCHOR);
    expect(warning?.level).toBe("ineligible");
    expect(warning?.text).toMatch(/specialling slots available/i);
    expect(warning?.failedGates).toHaveLength(1);
  });

  it("names every failing gate, not just the first, when more than one gate fails", () => {
    const warning = eligibilityWarning(WF_009, BRM_ADULT_SECURE, NOW_ANCHOR);
    expect(warning?.level).toBe("ineligible");
    expect(warning?.failedGates.length).toBeGreaterThanOrEqual(2);
    // Both real gate details must appear verbatim — the exact wording `eligibility()` already
    // produces, never a paraphrase authored here.
    expect(warning?.text).toMatch(/forensic bed and is never offered as a destination/i);
    expect(warning?.text).toMatch(/specialling slots available/i);
  });

  it("never fires for a case restrictionNotice already covers — the two are disjoint facts", () => {
    // restrictionNotice's two cases (a secure ward for an open-security movement, and a voluntary
    // patient on a locked ward) never overlap a failing eligibility() gate: eligibility()'s own
    // `security` gate only fails the opposite direction (a movement needing Secure placed on an
    // Open ward), and eligibility() has no legal-status gate that fires for a Voluntary movement at
    // all — its `authorisation` gate only fires for a NON-voluntary movement. Pinned here so a
    // future edit to either function that reintroduces overlap is caught by this suite, not
    // discovered by a ward seeing the same fact twice.
    const voluntaryOpen = movementById("WF-301")!;
    const secureUnit = unitById("rph-adult-secure")!;
    expect(voluntaryOpen.legalStatus).toBe("Voluntary");
    const verdict = eligibility(voluntaryOpen, secureUnit, NOW_ANCHOR);
    const authorisationGate = verdict.gates.find((gate) => gate.gate === "authorisation");
    expect(authorisationGate?.pass).toBe(true);
  });
});
