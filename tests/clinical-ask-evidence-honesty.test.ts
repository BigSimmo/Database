import { describe, expect, it } from "vitest";

import type { ClinicalAskEvidence, ClinicalAskRequest } from "@/lib/clinical-ask/contracts";
import { retrieveCatalogueEvidence } from "@/lib/clinical-ask/catalogue-evidence";
import { annotateEvidenceCoverage, assessEvidenceSufficiency } from "@/lib/clinical-ask/evidence-sufficiency";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";

const dsmProfile = clinicalAskModeProfile("dsm");

function dsmRequest(question: string): ClinicalAskRequest {
  return {
    mode: "dsm",
    question,
    confirmedContext: {},
    clarificationAnswers: {},
    priorTurns: [],
    allowExternalFallback: true,
    inputTransport: "typed",
  };
}

function evidenceItem(overrides: Partial<ClinicalAskEvidence> = {}): ClinicalAskEvidence {
  return {
    id: "indexed:one",
    tier: "indexed",
    title: "Example source",
    publisher: "Example publisher",
    jurisdiction: null,
    href: "/documents/example",
    extract: "The episode must last at least 2 weeks.",
    reviewState: "reviewed",
    publishedAt: "2026-01-01",
    updatedAt: "2026-06-01",
    retrievedAt: null,
    ...overrides,
  };
}

/**
 * The DSM catalogue is a vendored upstream snapshot. No record in it carries a
 * clinical review receipt, and 145 of the 146 carry no criteria at all. Calling
 * it "Authorised" and "reviewed" made Clinical Ask treat it as sufficient
 * evidence on its own, because `hasReviewedSupport` gates `sufficient`.
 */
describe("DSM catalogue evidence review state", () => {
  it("does not claim the DSM catalogue is reviewed or authorised", async () => {
    const evidence = await retrieveCatalogueEvidence(
      dsmRequest("major depressive disorder"),
      new AbortController().signal,
    );
    expect(evidence.length).toBeGreaterThan(0);
    for (const item of evidence) {
      expect(item.reviewState).not.toBe("reviewed");
      expect(item.publisher.toLowerCase()).not.toContain("authorised");
    }
  });

  it("says in the extract when a record carries no full criteria", async () => {
    const evidence = await retrieveCatalogueEvidence(
      dsmRequest("major depressive disorder"),
      new AbortController().signal,
    );
    const mdd = evidence.find((item) => item.href.endsWith("/major-depressive-disorder"));
    expect(mdd).toBeDefined();
    expect(mdd!.extract.toLowerCase()).toContain("full dsm-5-tr criteria are not included");
  });

  it("carries the export's generation date rather than leaving currency unknown", async () => {
    const evidence = await retrieveCatalogueEvidence(dsmRequest("bipolar ii disorder"), new AbortController().signal);
    expect(evidence[0]?.updatedAt).toBe("2026-07-14");
  });

  it("cannot make a DSM answer sufficient on catalogue evidence alone", async () => {
    const request = dsmRequest("What is the duration threshold for major depressive disorder?");
    const evidence = await retrieveCatalogueEvidence(request, new AbortController().signal);
    const coverage = annotateEvidenceCoverage(dsmProfile, request, evidence);
    const decision = assessEvidenceSufficiency({ profile: dsmProfile, request, evidence, coverage });
    expect(decision.sufficient).toBe(false);
    expect(decision.externalFallbackReason).not.toBeNull();
  });
});

/**
 * `annotateEvidenceCoverage` computed `directlySupports` once against the whole
 * request and then mapped that one verdict onto every section in the mode's
 * `sectionOrder`. So a passage about duration was recorded as direct support for
 * impairment and for exclusions, and the answer was declared sufficient.
 */
describe("section-level evidence coverage", () => {
  const request = dsmRequest("Does the depressive episode last at least 2 weeks?");
  const durationOnly = evidenceItem({
    id: "indexed:duration",
    extract: "The depressive episode must last at least 2 weeks.",
  });

  it("does not let a duration passage cover impairment or exclusions", () => {
    const coverage = annotateEvidenceCoverage(dsmProfile, request, [durationOnly]);
    const bySection = new Map(coverage.map((annotation) => [annotation.sectionId, annotation]));

    expect(bySection.get("duration")?.directlySupports).toBe(true);
    expect(bySection.get("impairment")?.directlySupports).toBe(false);
    expect(bySection.get("exclusions")?.directlySupports).toBe(false);
  });

  it("reports the uncovered sections rather than declaring the answer sufficient", () => {
    const coverage = annotateEvidenceCoverage(dsmProfile, request, [durationOnly]);
    const decision = assessEvidenceSufficiency({ profile: dsmProfile, request, evidence: [durationOnly], coverage });
    expect(decision.sufficient).toBe(false);
    expect(decision.missingSectionIds).toContain("impairment");
    expect(decision.missingSectionIds).toContain("exclusions");
    expect(decision.coveredSectionIds).toContain("duration");
    expect(decision.externalFallbackReason).toBe("coverage_gap");
  });

  it("covers the section the evidence actually speaks to, and only that one", () => {
    const impairment = evidenceItem({
      id: "indexed:impairment",
      extract: "The symptoms cause clinically significant impairment in social and occupational functioning.",
    });
    const coverage = annotateEvidenceCoverage(
      dsmProfile,
      dsmRequest("The symptoms cause clinically significant impairment in social and occupational functioning"),
      [impairment],
    );
    const bySection = new Map(coverage.map((annotation) => [annotation.sectionId, annotation]));
    expect(bySection.get("impairment")?.directlySupports).toBe(true);
    // The mirror image of the duration case: an impairment passage is not
    // evidence about duration or exclusions either.
    expect(bySection.get("duration")?.directlySupports).toBe(false);
    expect(bySection.get("exclusions")?.directlySupports).toBe(false);
  });
});

/**
 * A mixture of needs_review and unknown support fell through every branch and
 * left `externalFallbackReason` null, so the orchestrator had no reason to seek
 * corroboration even though nothing supporting the answer had been reviewed.
 */
describe("mixed review state", () => {
  it("gives an explicit fallback reason when no supporting evidence is reviewed", () => {
    const request = dsmRequest("Does the depressive episode last at least 2 weeks?");
    const mixed = [
      evidenceItem({
        id: "indexed:needs",
        reviewState: "needs_review",
        extract: "The depressive episode must last at least 2 weeks.",
      }),
      evidenceItem({
        id: "indexed:unknown",
        reviewState: "unknown",
        extract: "The depressive episode must last at least 2 weeks.",
      }),
    ];
    const coverage = annotateEvidenceCoverage(dsmProfile, request, mixed);
    const decision = assessEvidenceSufficiency({ profile: dsmProfile, request, evidence: mixed, coverage });
    expect(decision.sufficient).toBe(false);
    expect(decision.externalFallbackReason).not.toBeNull();
  });
});

/**
 * `conflictsWithEvidenceIds` was hard-coded empty, so two sources stating
 * different thresholds for the same thing never raised a conflict.
 */
describe("conflict detection between supporting sources", () => {
  it("flags two supporting sources that state different values of the same kind", () => {
    const request = dsmRequest("Does the depressive episode last at least 2 weeks?");
    const evidence = [
      evidenceItem({ id: "indexed:two-weeks", extract: "The depressive episode must last at least 2 weeks." }),
      evidenceItem({
        id: "indexed:four-weeks",
        extract: "The depressive episode must last at least 2 weeks, and at least 4 weeks in this setting.",
      }),
    ];
    const coverage = annotateEvidenceCoverage(dsmProfile, request, evidence);
    const conflicted = coverage.filter((annotation) => annotation.conflictsWithEvidenceIds.length > 0);
    expect(conflicted.length).toBeGreaterThan(0);

    const decision = assessEvidenceSufficiency({ profile: dsmProfile, request, evidence, coverage });
    expect(decision.sufficient).toBe(false);
    expect(decision.externalFallbackReason).toBe("conflict");
  });

  it("does not invent a conflict between sources that agree", () => {
    const request = dsmRequest("Does the depressive episode last at least 2 weeks?");
    const evidence = [
      evidenceItem({ id: "indexed:a", extract: "The depressive episode must last at least 2 weeks." }),
      evidenceItem({ id: "indexed:b", extract: "The depressive episode must last at least 2 weeks in every setting." }),
    ];
    const coverage = annotateEvidenceCoverage(dsmProfile, request, evidence);
    expect(coverage.every((annotation) => annotation.conflictsWithEvidenceIds.length === 0)).toBe(true);
  });
});
