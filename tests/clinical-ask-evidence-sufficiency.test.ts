import { describe, expect, it } from "vitest";

import {
  annotateEvidenceCoverage,
  assessEvidenceSufficiency,
  type EvidenceCoverageAnnotation,
} from "@/lib/clinical-ask/evidence-sufficiency";
import type { ClinicalAskEvidence, ClinicalAskRequest } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";

const profile = clinicalAskModeProfile("services");
const request = (question: string): ClinicalAskRequest => ({
  mode: "services",
  question,
  confirmedContext: {},
  clarificationAnswers: {},
  priorTurns: [],
  allowExternalFallback: true,
  inputTransport: "typed",
});
const source = (overrides: Partial<ClinicalAskEvidence> = {}): ClinicalAskEvidence => ({
  id: "indexed:one",
  tier: "indexed",
  title: "Example source",
  publisher: "Example publisher",
  jurisdiction: "Example jurisdiction",
  href: "/documents/example",
  extract: "The example service accepts referrals for adults within 6 weeks.",
  reviewState: "reviewed",
  publishedAt: "2026-01-01",
  updatedAt: "2026-06-01",
  retrievedAt: null,
  ...overrides,
});

describe("Clinical Ask evidence sufficiency", () => {
  it("is request-dependent for an identical evidence set", () => {
    const evidence = [source()];
    const coveredRequest = request("Does the example service accept adult referrals within 6 weeks?");
    const uncoveredRequest = request("Does the example service accept adult referrals within 12 weeks?");

    const covered = assessEvidenceSufficiency({
      profile,
      request: coveredRequest,
      evidence,
      coverage: annotateEvidenceCoverage(profile, coveredRequest, evidence),
    });
    const uncovered = assessEvidenceSufficiency({
      profile,
      request: uncoveredRequest,
      evidence,
      coverage: annotateEvidenceCoverage(profile, uncoveredRequest, evidence),
    });

    expect(covered).toMatchObject({ sufficient: true, uncoveredRequestAtoms: [] });
    expect(uncovered).toMatchObject({ sufficient: false, externalFallbackReason: "coverage_gap" });
    expect(uncovered.uncoveredRequestAtoms).toContain("12 weeks");
  });

  it("does not use review state to change relevance order", () => {
    const evidence = [source({ id: "needs", reviewState: "needs_review" }), source({ id: "reviewed" })];
    const coverage = annotateEvidenceCoverage(profile, request("adult referrals within 6 weeks"), evidence);
    expect([...new Set(coverage.map(({ evidenceId }) => evidenceId))]).toEqual(["needs", "reviewed"]);
  });

  it.each([
    ["needs review", source({ reviewState: "needs_review" }), "needs_review"],
    ["unknown currentness", source({ reviewState: "unknown", updatedAt: null, publishedAt: null }), "stale_or_unknown"],
  ] as const)("keeps %s evidence insufficient", (_label, evidence, reason) => {
    const inputRequest = request("adult referrals within 6 weeks");
    const coverage = annotateEvidenceCoverage(profile, inputRequest, [evidence]);
    expect(assessEvidenceSufficiency({ profile, request: inputRequest, evidence: [evidence], coverage })).toMatchObject(
      {
        sufficient: false,
        externalFallbackReason: reason,
      },
    );
  });

  it("keeps mixed reviewed and unreviewed support insufficient", () => {
    const evidence = [
      source({ id: "reviewed", reviewState: "reviewed" }),
      source({ id: "needs", reviewState: "needs_review", extract: "Occupational impairment is present." }),
    ];
    const inputRequest = request("adult referrals within 6 weeks with impairment");
    const coverage = annotateEvidenceCoverage(profile, inputRequest, evidence);
    // Force both items to count as direct support across required sections so the
    // review-state gate is what decides sufficiency.
    const forced = coverage.map((annotation) => ({ ...annotation, directlySupports: true }));
    expect(assessEvidenceSufficiency({ profile, request: inputRequest, evidence, coverage: forced })).toMatchObject({
      sufficient: false,
      externalFallbackReason: "needs_review",
    });
  });

  it("keeps unresolved conflicts insufficient", () => {
    const evidence = [source(), source({ id: "indexed:two", extract: "The pathway uses 12 weeks." })];
    const coverage: EvidenceCoverageAnnotation[] = profile.sectionOrder.map((sectionId) => ({
      evidenceId: evidence[0].id,
      sectionId,
      claimKind: "duration",
      matchedAtoms: ["6 weeks"],
      unmatchedAtoms: [],
      directlySupports: true,
      conflictsWithEvidenceIds: [evidence[1].id],
    }));
    expect(
      assessEvidenceSufficiency({ profile, request: request("within 6 weeks"), evidence, coverage }),
    ).toMatchObject({ sufficient: false, externalFallbackReason: "conflict", unresolvedConflictIds: ["indexed:two"] });
  });

  it("detects a contradictory threshold that fails exact request support", () => {
    const supporting = source({
      id: "indexed:support",
      extract: "The example service accepts referrals for adults within 2 weeks.",
    });
    const contradictory = source({
      id: "indexed:conflict",
      extract: "The example service accepts referrals for adults within 4 weeks.",
    });
    const inputRequest = request("Does the example service accept adult referrals within 2 weeks?");
    const evidence = [supporting, contradictory];
    const coverage = annotateEvidenceCoverage(profile, inputRequest, evidence);
    const decision = assessEvidenceSufficiency({ profile, request: inputRequest, evidence, coverage });

    expect(
      coverage.some(
        (row) => row.evidenceId === "indexed:support" && row.conflictsWithEvidenceIds.includes("indexed:conflict"),
      ),
    ).toBe(true);
    expect(decision).toMatchObject({ sufficient: false, externalFallbackReason: "conflict" });
    expect(decision.unresolvedConflictIds).toContain("indexed:conflict");
  });

  it("does not treat unrelated same-unit durations as a conflict when the request predicate agrees", () => {
    const first = source({
      id: "indexed:one",
      extract:
        "The example service accepts referrals for adults within 2 weeks. The structured programme lasts 12 weeks.",
    });
    const second = source({
      id: "indexed:two",
      extract: "The example service accepts referrals for adults within 2 weeks. The initial assessment takes 4 weeks.",
    });
    const inputRequest = request("Does the example service accept adult referrals within 2 weeks?");
    const evidence = [first, second];
    const coverage = annotateEvidenceCoverage(profile, inputRequest, evidence);
    const decision = assessEvidenceSufficiency({ profile, request: inputRequest, evidence, coverage });

    expect(decision.unresolvedConflictIds).toEqual([]);
    expect(decision).toMatchObject({ sufficient: true, externalFallbackReason: null });
  });

  it("does not let a duration-only passage cover claim sections without topic cues", () => {
    const dsm = clinicalAskModeProfile("dsm");
    const evidence = [
      source({
        extract: "The episode lasts at least 2 weeks.",
      }),
    ];
    const inputRequest = request("Does the episode last at least 2 weeks?");
    // DSM profile question shape still uses the services helper request factory;
    // only sectionOrder/cues matter for this coverage assertion.
    const coverage = annotateEvidenceCoverage(dsm, { ...inputRequest, mode: "dsm" }, evidence);
    const durationRows = coverage.filter((row) => row.sectionId === "duration" && row.directlySupports);
    const apparentRows = coverage.filter((row) => row.sectionId === "apparently_supported" && row.directlySupports);
    expect(durationRows.length).toBeGreaterThan(0);
    expect(apparentRows).toEqual([]);
  });

  it("detects contradictory request-predicate values inside one extract", () => {
    const evidence = [
      source({
        id: "indexed:self",
        extract: "The episode lasts at least 2 weeks. It lasts 4 weeks.",
      }),
    ];
    const inputRequest = request("Does the episode last at least 2 weeks?");
    const coverage = annotateEvidenceCoverage(profile, inputRequest, evidence);
    expect(
      coverage.some(
        (row) => row.evidenceId === "indexed:self" && row.conflictsWithEvidenceIds.includes("indexed:self"),
      ),
    ).toBe(true);
    const decision = assessEvidenceSufficiency({ profile, request: inputRequest, evidence, coverage });
    expect(decision).toMatchObject({ sufficient: false, externalFallbackReason: "conflict" });
  });
});
