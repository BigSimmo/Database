import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  citedRegisterPaths,
  reviewedContentDigest,
  sealReviewedPathDigests,
  validateClinicalHazardControls,
} from "../scripts/check-clinical-hazard-controls.mjs";
import { resolveReviewedCommitHistory, warnReviewedCommitSkipped } from "./helpers/reviewed-commit-history";

const manifest = JSON.parse(readFileSync(new URL("../docs/clinical-hazard-controls.json", import.meta.url), "utf8"));

/** A SHA that is well-formed and cannot exist, standing in for one a squash merge orphaned. */
const ORPHANED_COMMIT = "0".repeat(39) + "1";

describe("clinical hazard controls contract", () => {
  it("validates paths, tests, dates, required hazards, and open assurance boundaries", () => {
    // The shallow-checkout decision moved to a shared helper on 2026-09-07. The guard this
    // replaces asked only whether the commit OBJECT was present, so a session holding that
    // object while unable to walk to it failed the ancestry check and reported eight hazard
    // sign-off records as broken. They were not. See the helper for the full incident.
    const { checkGit, skipReason } = resolveReviewedCommitHistory(manifest.reviewedCommit);
    if (skipReason) warnReviewedCommitSkipped("clinical hazard controls", skipReason);
    expect(validateClinicalHazardControls(manifest, { checkGit })).toEqual([]);
  });

  // #D7K71C: this repository squash-merges, so an author cannot know the SHA their register
  // update will land as. PR #2882 pinned its own pre-squash branch head; the squash orphaned it
  // and every branch that merged main went red until it was repaired by hand. These four cases
  // pin the replacement: the reviewed CONTENT is what must still be provable, not the commit.
  describe("a squash merge that orphans the reviewed commit", () => {
    function orphaned() {
      const changed = structuredClone(manifest);
      const { sealed } = sealReviewedPathDigests(changed);
      sealed.reviewedCommit = ORPHANED_COMMIT;
      for (const hazard of sealed.hazards) hazard.reviewedCommit = ORPHANED_COMMIT;
      for (const decision of sealed.assuranceDecisions) decision.reviewedCommit = ORPHANED_COMMIT;
      return sealed;
    }

    it("passes when the recorded digests still prove the reviewed content", () => {
      expect(validateClinicalHazardControls(orphaned(), { checkGit: true })).toEqual([]);
    });

    it("fails, naming the remedy, when no digests were recorded", () => {
      const changed = orphaned();
      delete changed.reviewedPathDigests;
      const errors = validateClinicalHazardControls(changed, { checkGit: true });
      expect(errors.join("\n")).toContain("no reviewedPathDigests are recorded");
      expect(errors.join("\n")).toContain("npm run governance:seal-hazard-controls");
    });

    /**
     * Drift FAILS unless a reviewed, expiring exception covers it (audit F13, 2026-09-25).
     * It used to only warn, and by then fourteen safety-behaviour changes had landed in
     * src/lib/clinical-safety.ts and its neighbours since the 2026-08-23 review without anyone
     * re-reviewing them. The exception route keeps the old worry in check: an intended change
     * does not force a reflexive re-seal, but it does force a named, dated, time-limited record.
     */
    function drifted() {
      const changed = orphaned();
      const [firstCitedPath] = citedRegisterPaths(changed);
      changed.reviewedPathDigests[firstCitedPath] = reviewedContentDigest("not what was sealed");
      return { changed, firstCitedPath };
    }
    const NOW = new Date("2026-09-25T00:00:00Z");
    const exceptionFor = (path: string, overrides: Record<string, string> = {}) => ({
      path,
      reason: "Behaviour change under clinical re-review",
      recordedBy: "Engineering (not a clinical review)",
      recordedOn: "2026-09-25",
      expiresOn: "2026-10-25",
      ...overrides,
    });

    it("fails when a reviewed control has changed since it was sealed and no exception covers it", () => {
      const { changed, firstCitedPath } = drifted();
      const errors = validateClinicalHazardControls(changed, { checkGit: true, now: NOW }).join("\n");
      expect(errors).toContain("CLINICAL_HAZARD_CONTROLS_CONTENT_DRIFT");
      expect(errors).toContain(firstCitedPath);
      expect(errors).toContain("npm run governance:seal-hazard-controls");
    });

    it("passes while a named, unexpired exception covers the drifted path", () => {
      const { changed, firstCitedPath } = drifted();
      changed.driftExceptions = [exceptionFor(firstCitedPath)];
      expect(validateClinicalHazardControls(changed, { checkGit: true, now: NOW })).toEqual([]);
    });

    it("fails once the exception has expired", () => {
      const { changed, firstCitedPath } = drifted();
      changed.driftExceptions = [exceptionFor(firstCitedPath, { recordedOn: "2026-08-01", expiresOn: "2026-09-01" })];
      const errors = validateClinicalHazardControls(changed, { checkGit: true, now: NOW }).join("\n");
      expect(errors).toContain("has expired");
      expect(errors).toContain(firstCitedPath);
    });

    it("rejects an exception without a reason or author, or one that runs longer than 45 days", () => {
      const { changed, firstCitedPath } = drifted();
      changed.driftExceptions = [
        exceptionFor(firstCitedPath, { reason: " ", recordedBy: "", expiresOn: "2026-12-31" }),
      ];
      const errors = validateClinicalHazardControls(changed, { checkGit: true, now: NOW }).join("\n");
      expect(errors).toContain("reason is required");
      expect(errors).toContain("recordedBy is required");
      expect(errors).toContain("at most 45 days");
    });

    it("drops the exceptions when the register is re-sealed, since nothing has drifted any more", () => {
      const { changed, firstCitedPath } = drifted();
      changed.driftExceptions = [exceptionFor(firstCitedPath)];
      expect(sealReviewedPathDigests(changed).sealed.driftExceptions).toBeUndefined();
    });

    it("still fails when a cited path has no recorded digest at all", () => {
      const changed = orphaned();
      const [firstCitedPath] = citedRegisterPaths(changed);
      delete changed.reviewedPathDigests[firstCitedPath];
      const errors = validateClinicalHazardControls(changed, { checkGit: true });
      expect(errors.join("\n")).toContain(`no recorded digest for ${firstCitedPath}`);
    });

    // The point of saying it once: eleven entries pin the same commit, and eleven copies of the
    // same finding is how a real one gets skimmed past.
    it("reports the unreachable commit once, not once per entry", () => {
      const changed = orphaned();
      delete changed.reviewedPathDigests;
      const errors = validateClinicalHazardControls(changed, { checkGit: true });
      expect(errors.filter((error: string) => error.includes(ORPHANED_COMMIT))).toHaveLength(1);
    });
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

  /**
   * The symbol-presence check escapes regex metacharacters before wrapping the symbol in
   * word boundaries. Until audit L22 the escape class was mis-written so nothing was
   * escaped: a dotted symbol acted as a wildcard (fail-open) and a bracket symbol threw.
   * The sentinels below live in this file, which the fixture names as its control path:
   * `fooxbar` and `sentinel(x)` — the dotted symbol itself is assembled at runtime so it
   * never appears here literally.
   */
  it("escapes regex metacharacters in control symbols instead of treating them as wildcards", () => {
    const self = "tests/clinical-hazard-controls.test.ts";
    const dotted = ["foo", "bar"].join(".");
    const changed = structuredClone(manifest);
    changed.hazards[0].controlPaths = [self];
    changed.hazards[0].tests = [self];
    changed.hazards[0].controlSymbols = [dotted];
    expect(validateClinicalHazardControls(changed, { checkFiles: true, checkGit: false })).toContain(
      `H1: control symbol ${dotted} not found in controlPaths`,
    );

    const bracketed = ["sentinel", "("].join("");
    changed.hazards[0].controlSymbols = [bracketed];
    let errors: string[] = [];
    expect(() => {
      errors = validateClinicalHazardControls(changed, { checkFiles: true, checkGit: false });
    }).not.toThrow();
    expect(errors).not.toContain(`H1: control symbol ${bracketed} not found in controlPaths`);
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
