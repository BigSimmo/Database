import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateClinicalHazardControls } from "../scripts/check-clinical-hazard-controls.mjs";

const manifest = JSON.parse(readFileSync(new URL("../docs/clinical-hazard-controls.json", import.meta.url), "utf8"));

describe("clinical hazard controls contract", () => {
  it("validates paths, tests, dates, required hazards, and open assurance boundaries", () => {
    expect(validateClinicalHazardControls(manifest)).toEqual([]);
  });

  it("does not allow static evidence to close clinical truth or external risk acceptance", () => {
    const changed = structuredClone(manifest);
    changed.assuranceDecisions[0].state = "controlled";
    changed.assuranceDecisions[1].state = "accepted_decision";
    const errors = validateClinicalHazardControls(changed, { checkFiles: false });
    expect(errors).toContain("clinical truth authority closure requires an external evidence reference");
    expect(errors).toContain("external risk acceptance closure requires acceptanceReference and acceptedByRole");
  });

  it("requires partial hazards to name controls, paths, and tests", () => {
    const changed = structuredClone(manifest);
    changed.hazards[0].controlPaths = [];
    changed.hazards[0].tests = [];
    expect(validateClinicalHazardControls(changed, { checkFiles: false })).toContain(
      "H1: partial state requires controlSymbols, controlPaths, and tests",
    );
  });

  /**
   * Existence is not evidence. Until audit M33 the validator only checked that each
   * listed test file existed and matched `tests/*.test.ts`, so a hazard's named proofs
   * could be emptied of the relevant case — or the control symbol renamed and re-added
   * as a comment — while CLINICAL_HAZARD_CONTROLS_PASS kept printing.
   */
  it("requires at least one listed test to reference a control symbol or control path", () => {
    const changed = structuredClone(manifest);
    // A real, existing test file that names none of H1's controls.
    changed.hazards[0].tests = ["tests/clinical-hazard-controls.test.ts"];
    const errors = validateClinicalHazardControls(changed, { checkFiles: true, checkGit: false });
    expect(errors).toContain(
      "H1: no listed test references a control symbol or imports a control path (tests/clinical-hazard-controls.test.ts)",
    );
    // The committed manifest satisfies the rule for every hazard.
    expect(validateClinicalHazardControls(manifest, { checkFiles: true, checkGit: false })).toEqual([]);
  });

  it("rejects stale or impossible dates, fake commits, and escaped evidence paths", () => {
    const changed = structuredClone(manifest);
    changed.reviewExpiresAt = "2026-08-22";
    changed.hazards[0].reviewedAt = "2026-02-30";
    changed.hazards[1].reviewedCommit = "f".repeat(40);
    changed.hazards[2].controlPaths = ["C:/Windows/System32/drivers/etc/hosts"];
    const errors = validateClinicalHazardControls(changed, { now: new Date("2026-08-23T12:00:00Z") });
    expect(errors).toContain("manifest: review has expired");
    expect(errors).toContain("H1: review dates must be ISO dates");
    expect(errors).toContain(`H2: reviewedCommit does not exist ${"f".repeat(40)}`);
    expect(errors).toContain("H2: reviewedCommit must match manifest");
    expect(errors).toContain("H3: missing path C:/Windows/System32/drivers/etc/hosts");
  });

  it("requires an authorised role and governance record for accepted decisions", () => {
    const changed = structuredClone(manifest);
    const decision = changed.assuranceDecisions[1];
    decision.state = "accepted_decision";
    decision.acceptedByRole = "Application developer";
    decision.acceptanceReference = "docs/clinical-hazard-analysis.md";
    const errors = validateClinicalHazardControls(changed, { checkFiles: false });
    expect(errors).toContain("EXTERNAL-RISK-ACCEPTANCE: acceptedByRole must be Authorised risk owner");
    expect(errors).toContain(
      "EXTERNAL-RISK-ACCEPTANCE: acceptanceReference must be an existing docs/governance record",
    );
  });
});
