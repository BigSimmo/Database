import { describe, expect, it } from "vitest";
import { convertArtifact } from "../scripts/build-ranking-snapshot";

// The 11 golden case IDs that hardNegativeTemplates in build-ranking-snapshot.ts attach to.
const TEMPLATED_CASE_IDS = [
  "agitation-im-po-options",
  "opioid-withdrawal-doses",
  "clozapine-anc-threshold",
  "lithium-therapy-monitoring",
  "alcohol-ciwa-threshold",
  "clozapine-cbc-abbreviation-threshold",
  "flowchart-next-step",
  "patient-safety-plan-include",
  "active-community-patient-ed",
  "admission-discharge-comparison",
  "depression-adults-vs-children",
];

function artifactCase(id: string) {
  return {
    id,
    query: `query for ${id}`,
    expectedDocumentSubstrings: ["doc"],
    expectedContentTerms: [],
    topResults: [],
  };
}

function artifactWithCases(ids: string[]) {
  return { results: ids.map(artifactCase) };
}

function fillerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `filler-case-${index + 1}`);
}

describe("build-ranking-snapshot hard-negative attachment", () => {
  it("attaches every hard-negative template when all templated cases are present", () => {
    const ids = [...TEMPLATED_CASE_IDS, ...fillerIds(36 - TEMPLATED_CASE_IDS.length)];
    const snapshot = convertArtifact(artifactWithCases(ids));
    const hardNegativeCount = snapshot.cases
      .flatMap((snapshotCase) => snapshotCase.candidates)
      .filter((candidate) => candidate.hardNegative).length;
    expect(hardNegativeCount).toBe(12);
  });

  it("fails loudly when a templated golden case is renamed or removed", () => {
    // Templates match caseId by filter; before this guard a rename silently dropped its hard
    // negatives, eroding below-threshold protection with no error until snapshot validation.
    const withoutClozapineAnc = TEMPLATED_CASE_IDS.filter((id) => id !== "clozapine-anc-threshold");
    const ids = [...withoutClozapineAnc, ...fillerIds(36 - withoutClozapineAnc.length)];
    expect(() => convertArtifact(artifactWithCases(ids))).toThrow(
      /Hard-negative template caseId\(s\) match no artifact case: clozapine-anc-threshold/,
    );
  });

  it("still enforces the 36-case floor before template attachment", () => {
    expect(() => convertArtifact(artifactWithCases(TEMPLATED_CASE_IDS))).toThrow(/at least 36 cases/);
  });
});
