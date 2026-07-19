import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RagQueryClass } from "../src/lib/types";
import { candidateFeatures, labelMatches, type ArtifactCandidate } from "./lib/ranking-snapshot-builder";
import {
  RANKING_SNAPSHOT_VERSION,
  type RankingCandidateFeatures,
  type RankingSnapshot,
  type RankingSnapshotCandidate,
  validateRankingSnapshot,
} from "./lib/ranking-tuning";

type ArtifactCase = {
  id: string;
  query: string;
  expectedQueryClass?: RagQueryClass;
  actualQueryClass?: RagQueryClass;
  expectedDocumentSubstrings?: string[];
  expectedContentTerms?: string[];
  topResults?: ArtifactCandidate[];
};

type RetrievalArtifact = { results?: ArtifactCase[] };

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function candidateHash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const hardNegativeTemplates: Array<{
  caseId: string;
  key: string;
  category: NonNullable<RankingSnapshotCandidate["hardNegative"]>["category"];
  risk: NonNullable<RankingSnapshotCandidate["hardNegative"]>["risk"];
  features: RankingCandidateFeatures;
}> = [
  ["agitation-im-po-options", "dose-boilerplate-1", "dose_administration_boilerplate", "high"],
  ["opioid-withdrawal-doses", "dose-boilerplate-2", "dose_administration_boilerplate", "high"],
  ["clozapine-anc-threshold", "wrong-medication-1", "wrong_medication_document", "high"],
  ["lithium-therapy-monitoring", "wrong-medication-2", "wrong_medication_document", "high"],
  ["alcohol-ciwa-threshold", "wrong-threshold-1", "mismatched_threshold", "high"],
  ["clozapine-cbc-abbreviation-threshold", "wrong-threshold-2", "mismatched_threshold", "high"],
  ["flowchart-next-step", "flowchart-no-action-1", "flowchart_missing_action", "high"],
  ["flowchart-next-step", "flowchart-no-action-2", "flowchart_missing_action", "high"],
  ["patient-safety-plan-include", "stale-duplicate-1", "document_version_duplicate", "medium"],
  ["active-community-patient-ed", "stale-duplicate-2", "document_version_duplicate", "medium"],
  ["admission-discharge-comparison", "single-doc-crowding-1", "comparison_single_document_crowding", "medium"],
  ["depression-adults-vs-children", "single-doc-crowding-2", "comparison_single_document_crowding", "medium"],
].map(([caseId, key, category, risk], index) => ({
  caseId,
  key,
  category,
  risk,
  features: {
    hybridRelevance: index >= 8 ? 0.78 : 0.7,
    lexicalCoverage: index >= 10 ? 0.08 : 0.02,
    reciprocalRankFusion: index % 2 === 0 ? 0.03 : 0,
    titleSectionRelevance: index >= 8 ? 0.16 : 0.08,
    metadataRelevance: 0.04,
    clinicalEvidence: index >= 10 ? 0.04 : -0.02,
    fixedAdjustment: risk === "high" ? -0.3 : -0.18,
  },
})) as Array<{
  caseId: string;
  key: string;
  category: NonNullable<RankingSnapshotCandidate["hardNegative"]>["category"];
  risk: NonNullable<RankingSnapshotCandidate["hardNegative"]>["risk"];
  features: RankingCandidateFeatures;
}>;

function convertArtifact(artifact: RetrievalArtifact): RankingSnapshot {
  if (!Array.isArray(artifact.results) || artifact.results.length !== 36) {
    throw new Error("Expected a retrieval artifact containing exactly 36 cases");
  }
  const cases = artifact.results.map((testCase) => {
    const expectedDocuments = testCase.expectedDocumentSubstrings ?? [];
    const expectedContent = testCase.expectedContentTerms ?? [];
    const candidates = (testCase.topResults ?? []).map((candidate, index): RankingSnapshotCandidate => {
      const documentText = `${candidate.title ?? ""} ${candidate.file_name ?? ""}`.toLowerCase();
      const contentText = (candidate.content_preview ?? "").toLowerCase();
      const documentMatch = expectedDocuments.some((label) => labelMatches(documentText, label));
      const contentMatch =
        expectedContent.length > 0 && expectedContent.every((label) => labelMatches(contentText, label));
      return {
        candidateHash: candidateHash(`${testCase.id}:${candidate.chunk_id ?? `rank-${index + 1}`}`),
        relevanceGrade: documentMatch && contentMatch ? 3 : documentMatch ? 2 : contentMatch ? 1 : 0,
        documentMatch,
        contentMatch,
        features: candidateFeatures(candidate),
      };
    });
    for (const hardNegative of hardNegativeTemplates.filter((item) => item.caseId === testCase.id)) {
      candidates.push({
        candidateHash: candidateHash(`${testCase.id}:${hardNegative.key}`),
        relevanceGrade: 0,
        documentMatch: false,
        contentMatch: false,
        features: hardNegative.features,
        hardNegative: { category: hardNegative.category, risk: hardNegative.risk },
      });
    }
    return {
      id: testCase.id,
      query: testCase.query,
      queryClass: testCase.actualQueryClass ?? testCase.expectedQueryClass ?? "unsupported_or_general",
      expectedLabels: { documents: expectedDocuments, content: expectedContent },
      candidates,
    };
  });
  return {
    schema: "rag-ranking-candidate-snapshot",
    version: RANKING_SNAPSHOT_VERSION,
    sourceCaseCount: cases.length,
    sanitization: {
      candidateIdentity: "sha256",
      excludes: ["raw_uuid", "source_passage", "patient_data", "provider_metadata", "document_storage_path"],
    },
    cases,
  };
}

function main() {
  const input = argument("--input");
  const output = argument("--output");
  if (!input || !output)
    throw new Error("Usage: build-ranking-snapshot --input <artifact.json> --output <snapshot.json>");
  const artifact = JSON.parse(readFileSync(resolve(input), "utf8")) as RetrievalArtifact;
  const snapshot = validateRankingSnapshot(convertArtifact(artifact));
  writeFileSync(resolve(output), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: resolve(output), cases: snapshot.cases.length, version: snapshot.version }));
}

main();
