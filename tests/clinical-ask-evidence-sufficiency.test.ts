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
});
