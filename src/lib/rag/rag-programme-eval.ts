import { createHash } from "node:crypto";

import rawProgrammeFixture from "@/data/rag-programme-failures.v1.json";
import type {
  AdaptiveAnswerShape,
  ClinicalSourceRole,
  RagInsufficiencyReason,
  RagSubquestionPurpose,
  SiteContentDomain,
  SiteContentPartitionState,
  SourceCorpusScope,
} from "@/lib/types";

export type RagQueryPlanKind = "single" | "decomposed" | "clarification_required";
export type RagProgrammeMode = "legacy" | "shadow" | "canary";
export type RagAugmentationOutcome = "not_needed" | "used" | "no_eligible_evidence" | "unavailable" | "disabled";
export type RagGenerationOutcome = "generated" | "extractive" | "source_only" | "failed";
export type RagReconciliationOutcome = "not_applicable" | "matched" | "mismatch";

export type RagProgrammeConflictField =
  | "source_identity"
  | "publication_or_effective_date"
  | "jurisdiction"
  | "source_role"
  | "material_difference"
  | "local_primary_decision"
  | "review_flag";

export type RagProgrammeExpectation = {
  readonly expectedCorpusScopes: readonly SourceCorpusScope[];
  readonly expectedSourceRoles: readonly ClinicalSourceRole[];
  readonly expectedSiteDomains: readonly SiteContentDomain[];
  readonly expectedPublicSiteContentState: SiteContentPartitionState | "not_applicable";
  readonly expectedSubquestionPurposes: readonly RagSubquestionPurpose[];
  readonly minimumDirectSubquestions: number;
  readonly allowedAnswerShapes: readonly AdaptiveAnswerShape[];
  readonly requireSupportedPart: boolean;
  readonly requireExactGap: boolean;
  readonly expectedConflict: {
    readonly localDocumentId: string;
    readonly australianDocumentId: string;
    readonly requireVisibleFields: readonly RagProgrammeConflictField[];
  } | null;
  readonly forbiddenFallbackReasons: readonly RagInsufficiencyReason[];
  readonly requiredFacts: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly incrementalEligibility: "none" | "lead" | "independent_sections";
};

export type RagProgrammeHardViolation =
  | "access_boundary"
  | "healthdirect_used"
  | "link_only_content_used"
  | "source_role_mismatch"
  | "unsupported_citation"
  | "unsupported_number"
  | "prompt_injection"
  | "governance"
  | "conflict_contract"
  | "stale_site_content"
  | "site_public_read_mismatch"
  | "site_non_admin_mutation"
  | "site_authority_escalation"
  | "site_domain_miss"
  | "incremental_reconciliation";

export type RagProgrammeCaseResult = {
  id: string;
  caseFingerprint: string;
  passed: boolean;
  falseInsufficiency: boolean;
  supportedPartRetained: boolean;
  documentReciprocalRank: number;
  contentReciprocalRank: number;
  hardViolations: RagProgrammeHardViolation[];
  failedExpectations: string[];
  totalLatencyMs: number | null;
  estimatedCostUsd: number | null;
};

export type RagProgrammeGatePolicy = {
  version: "rag-programme-gate-v1";
  requireDocumentRecall: 1;
  requireContentRecall: 1;
  maximumHardViolations: 0;
  maximumPerCaseRankRegressions: 0;
  maximumP95LatencyMultiplier: 1.1;
  maximumEstimatedCostMultiplier: 1.15;
};

export const RAG_PROGRAMME_GATE_POLICY = Object.freeze({
  version: "rag-programme-gate-v1",
  requireDocumentRecall: 1,
  requireContentRecall: 1,
  maximumHardViolations: 0,
  maximumPerCaseRankRegressions: 0,
  maximumP95LatencyMultiplier: 1.1,
  maximumEstimatedCostMultiplier: 1.15,
} satisfies RagProgrammeGatePolicy);

export type RagProgrammeFixtureCase = {
  readonly id: string;
  readonly latencyTargetMs: number;
  readonly caseFingerprint: string;
  readonly privacyReview: {
    readonly status: "approved_deidentified";
    readonly reviewedOn: string;
    readonly reviewerRole: "clinical_governance";
  };
  readonly expectedDocuments: readonly string[];
  readonly expectation: RagProgrammeExpectation;
};

export type RagProgrammeEvaluationDiagnostics = {
  observedCorpusScopes: readonly SourceCorpusScope[];
  observedSourceRoles: readonly ClinicalSourceRole[];
  observedSiteDomains: readonly SiteContentDomain[];
  publicSiteContentState: SiteContentPartitionState | "not_applicable";
  answerShape: AdaptiveAnswerShape;
  directSubquestionPurposes: readonly RagSubquestionPurpose[];
  directEvidenceSubquestionCount: number;
  insufficiencyReason: RagInsufficiencyReason | null;
  supportedPartRetained: boolean;
  exactGapNamed: boolean;
  observedConflict: {
    localDocumentId: string;
    australianDocumentId: string;
    visibleFields: readonly RagProgrammeConflictField[];
  } | null;
  requiredFactsPresent: readonly string[];
  forbiddenPatternsFound: readonly string[];
  documentReciprocalRank: number;
  contentReciprocalRank: number;
  hardViolations: readonly RagProgrammeHardViolation[];
  totalLatencyMs: number | null;
  estimatedCostUsd: number | null;
};

export type RagProgrammeEvaluationCase = RagProgrammeFixtureCase & {
  diagnostics: RagProgrammeEvaluationDiagnostics;
};

export type RagProgrammeFixture = {
  readonly schemaVersion: 1;
  readonly caseSetFingerprint: string;
  readonly cases: readonly RagProgrammeFixtureCase[];
};

export type RagProgrammePopulationFingerprintInput = {
  sourcePolicyVersion: string;
  indexGeneration: string;
  siteContentRegistryVersion: string;
  publicSiteContentReleaseId: string | null;
  publicSiteContentStaticManifestDigest: string | null;
  publicSiteContentDynamicStateDigest: string | null;
  publicSiteContentReleaseDigest: string | null;
  publicSiteContentState: SiteContentPartitionState;
  publicSiteContentSnapshotFingerprint: string | null;
};

export type RagProgrammeEvalArtifact = {
  schemaVersion: 1;
  evaluatedGitSha: string;
  evaluationVariant: "legacy" | "candidate";
  caseSetFingerprint: string;
  populationFingerprint: string;
  sourcePolicyVersion: string;
  indexGeneration: string;
  siteContentRegistryVersion: string;
  publicSiteContentReleaseId: string | null;
  publicSiteContentStaticManifestDigest: string | null;
  publicSiteContentDynamicStateDigest: string | null;
  publicSiteContentReleaseDigest: string | null;
  publicSiteContentState: SiteContentPartitionState;
  publicSiteContentSnapshotFingerprint: string | null;
  promptVersion: string;
  rolloutMode: RagProgrammeMode;
  cases: RagProgrammeCaseResult[];
  aggregates: {
    documentRecall: number;
    contentRecall: number;
    falseInsufficiencyRate: number;
    supportedPartRetentionRate: number;
    p95TotalLatencyMs: number;
    estimatedCostUsd: number | null;
  };
};

export type RagProgrammeComparison = {
  decision: "GO" | "NO_GO";
  reasons: string[];
};

const SOURCE_CORPUS_SCOPES = new Set<SourceCorpusScope>([
  "uploaded_local",
  "clinical_kb_site",
  "australian_public",
  "international_supplementary",
]);
const CLINICAL_SOURCE_ROLES = new Set<ClinicalSourceRole>([
  "local_guideline",
  "clinical_guideline",
  "clinical_reference",
  "service_directory",
  "form_reference",
  "tool_reference",
  "safety_alert",
  "regulatory",
  "quality_standard",
  "legal",
  "subsidy",
  "professional_review",
  "service_policy",
  "reference_link",
]);
const SITE_CONTENT_DOMAINS = new Set<SiteContentDomain>([
  "services",
  "forms",
  "medications",
  "differentials",
  "specifiers",
  "dsm",
  "formulation",
  "therapies",
  "dictionary",
  "factsheets",
  "calculators",
  "tools",
]);
const SITE_CONTENT_STATES = new Set<SiteContentPartitionState | "not_applicable">([
  "current",
  "updating",
  "stale",
  "unavailable",
  "disabled",
  "not_applicable",
]);
const SITE_CONTENT_PARTITION_STATES = new Set<SiteContentPartitionState>([
  "current",
  "updating",
  "stale",
  "unavailable",
  "disabled",
]);
const SUBQUESTION_PURPOSES = new Set<RagSubquestionPurpose>([
  "primary",
  "comparison_side",
  "required_action",
  "monitoring",
  "risk",
  "special_population",
]);
const ANSWER_SHAPES = new Set<AdaptiveAnswerShape>(["narrow", "focused", "comprehensive", "comparison", "partial"]);
const INSUFFICIENCY_REASONS = new Set<RagInsufficiencyReason>([
  "not_in_corpus",
  "retrieval_miss",
  "insufficient_claim_support",
  "source_role_mismatch",
  "source_conflict",
  "governance_block",
  "site_content_updating",
  "site_content_stale",
  "site_content_unavailable",
  "timeout",
  "provider_failure",
]);
const CONFLICT_FIELDS = new Set<RagProgrammeConflictField>([
  "source_identity",
  "publication_or_effective_date",
  "jurisdiction",
  "source_role",
  "material_difference",
  "local_primary_decision",
  "review_flag",
]);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function withoutCaseFingerprint(testCase: RagProgrammeFixtureCase | Record<string, unknown>) {
  const { caseFingerprint: _ignored, ...stable } = testCase;
  void _ignored;
  return stable;
}

export function fingerprintRagProgrammeCaseSet(
  cases: ReadonlyArray<RagProgrammeFixtureCase | Record<string, unknown>>,
): string {
  return sha256Fingerprint({
    schemaVersion: 1,
    cases: cases.map(withoutCaseFingerprint).sort((left, right) => String(left.id).localeCompare(String(right.id))),
  });
}

function populationInputFailures(input: RagProgrammePopulationFingerprintInput): string[] {
  const failures: string[] = [];
  for (const field of ["sourcePolicyVersion", "indexGeneration", "siteContentRegistryVersion"] as const) {
    if (typeof input[field] !== "string" || input[field].trim().length === 0) failures.push(field);
  }
  if (!SITE_CONTENT_PARTITION_STATES.has(input.publicSiteContentState)) failures.push("publicSiteContentState");
  return failures;
}

export function fingerprintRagProgrammePopulation(input: RagProgrammePopulationFingerprintInput): string {
  const failures = populationInputFailures(input);
  if (failures.length > 0) {
    throw new Error(`Invalid RAG programme population fields: ${failures.join(", ")}`);
  }
  return sha256Fingerprint(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  const unknown = actual.filter((key) => !required.includes(key));
  const missing = required.filter((key) => !actual.includes(key));
  if (unknown.length > 0 || missing.length > 0) {
    throw new Error(
      `${path} must contain exactly [${required.join(", ")}]` +
        (unknown.length > 0 ? `; unknown [${unknown.join(", ")}]` : "") +
        (missing.length > 0 ? `; missing [${missing.join(", ")}]` : ""),
    );
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${path} must be a non-empty string`);
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${path} must be an array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${path} must not contain duplicates`);
}

function assertEnumArray<T extends string>(value: unknown, allowed: Set<T>, path: string): asserts value is T[] {
  assertStringArray(value, path);
  if (!value.every((item) => allowed.has(item as T))) throw new Error(`${path} contains an unknown value`);
}

function assertExpectation(value: unknown, path: string): asserts value is RagProgrammeExpectation {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  assertExactKeys(
    value,
    [
      "expectedCorpusScopes",
      "expectedSourceRoles",
      "expectedSiteDomains",
      "expectedPublicSiteContentState",
      "expectedSubquestionPurposes",
      "minimumDirectSubquestions",
      "allowedAnswerShapes",
      "requireSupportedPart",
      "requireExactGap",
      "expectedConflict",
      "forbiddenFallbackReasons",
      "requiredFacts",
      "forbiddenPatterns",
      "incrementalEligibility",
    ],
    path,
  );
  assertEnumArray(value.expectedCorpusScopes, SOURCE_CORPUS_SCOPES, `${path}.expectedCorpusScopes`);
  assertEnumArray(value.expectedSourceRoles, CLINICAL_SOURCE_ROLES, `${path}.expectedSourceRoles`);
  assertEnumArray(value.expectedSiteDomains, SITE_CONTENT_DOMAINS, `${path}.expectedSiteDomains`);
  if (!SITE_CONTENT_STATES.has(value.expectedPublicSiteContentState as SiteContentPartitionState)) {
    throw new Error(`${path}.expectedPublicSiteContentState contains an unknown value`);
  }
  assertEnumArray(value.expectedSubquestionPurposes, SUBQUESTION_PURPOSES, `${path}.expectedSubquestionPurposes`);
  if (!Number.isInteger(value.minimumDirectSubquestions) || Number(value.minimumDirectSubquestions) < 0) {
    throw new Error(`${path}.minimumDirectSubquestions must be a non-negative integer`);
  }
  assertEnumArray(value.allowedAnswerShapes, ANSWER_SHAPES, `${path}.allowedAnswerShapes`);
  if (value.allowedAnswerShapes.length === 0) throw new Error(`${path}.allowedAnswerShapes must not be empty`);
  if (typeof value.requireSupportedPart !== "boolean" || typeof value.requireExactGap !== "boolean") {
    throw new Error(`${path} support and gap requirements must be boolean`);
  }
  if (value.expectedConflict !== null) {
    if (!isRecord(value.expectedConflict)) throw new Error(`${path}.expectedConflict must be an object or null`);
    assertExactKeys(
      value.expectedConflict,
      ["localDocumentId", "australianDocumentId", "requireVisibleFields"],
      `${path}.expectedConflict`,
    );
    assertString(value.expectedConflict.localDocumentId, `${path}.expectedConflict.localDocumentId`);
    assertString(value.expectedConflict.australianDocumentId, `${path}.expectedConflict.australianDocumentId`);
    assertEnumArray(
      value.expectedConflict.requireVisibleFields,
      CONFLICT_FIELDS,
      `${path}.expectedConflict.requireVisibleFields`,
    );
  }
  assertEnumArray(value.forbiddenFallbackReasons, INSUFFICIENCY_REASONS, `${path}.forbiddenFallbackReasons`);
  assertStringArray(value.requiredFacts, `${path}.requiredFacts`);
  assertStringArray(value.forbiddenPatterns, `${path}.forbiddenPatterns`);
  if (!new Set(["none", "lead", "independent_sections"]).has(String(value.incrementalEligibility))) {
    throw new Error(`${path}.incrementalEligibility contains an unknown value`);
  }
}

export function validateRagProgrammeFixture(fixture: unknown): RagProgrammeFixture {
  if (!isRecord(fixture) || fixture.schemaVersion !== 1)
    throw new Error("RAG programme fixture schemaVersion must be 1");
  assertExactKeys(fixture, ["schemaVersion", "caseSetFingerprint", "cases"], "RAG programme fixture");
  assertString(fixture.caseSetFingerprint, "RAG programme fixture caseSetFingerprint");
  if (!Array.isArray(fixture.cases) || fixture.cases.length !== 26) {
    throw new Error("RAG programme fixture must contain exactly 26 canonical cases");
  }

  const ids = new Set<string>();
  const cases = fixture.cases.map((value, index) => {
    const path = `RAG programme fixture cases[${index}]`;
    if (!isRecord(value)) throw new Error(`${path} must be an object`);
    assertExactKeys(value, ["id", "latencyTargetMs", "privacyReview", "expectedDocuments", "expectation"], path);
    assertString(value.id, `${path}.id`);
    if (ids.has(value.id)) throw new Error(`${path}.id is duplicated`);
    ids.add(value.id);
    if (!isRecord(value.privacyReview)) throw new Error(`${path}.privacyReview must be an object`);
    assertExactKeys(value.privacyReview, ["status", "reviewedOn", "reviewerRole"], `${path}.privacyReview`);
    if (
      value.privacyReview.status !== "approved_deidentified" ||
      value.privacyReview.reviewerRole !== "clinical_governance"
    ) {
      throw new Error(`${path}.privacyReview must record approved de-identification governance`);
    }
    assertString(value.privacyReview.reviewedOn, `${path}.privacyReview.reviewedOn`);
    if (!Number.isInteger(value.latencyTargetMs) || Number(value.latencyTargetMs) <= 0) {
      throw new Error(`${path}.latencyTargetMs must be a positive integer`);
    }
    assertStringArray(value.expectedDocuments, `${path}.expectedDocuments`);
    assertExpectation(value.expectation, `${path}.expectation`);

    const stableCase = {
      id: value.id,
      latencyTargetMs: Number(value.latencyTargetMs),
      privacyReview: {
        status: "approved_deidentified" as const,
        reviewedOn: value.privacyReview.reviewedOn,
        reviewerRole: "clinical_governance" as const,
      },
      expectedDocuments: value.expectedDocuments,
      expectation: value.expectation,
    } satisfies Omit<RagProgrammeFixtureCase, "caseFingerprint">;
    return { ...stableCase, caseFingerprint: sha256Fingerprint(stableCase) };
  });

  const actualFingerprint = fingerprintRagProgrammeCaseSet(cases);
  if (actualFingerprint !== fixture.caseSetFingerprint) {
    throw new Error(
      `RAG programme fixture fingerprint mismatch: expected ${fixture.caseSetFingerprint}, received ${actualFingerprint}`,
    );
  }
  return deepFreeze({ schemaVersion: 1, caseSetFingerprint: fixture.caseSetFingerprint, cases });
}

export const ragProgrammeFixture = validateRagProgrammeFixture(rawProgrammeFixture);

function assertNonNegativeFinite(name: string, value: number | null, maximum?: number): void {
  if (value === null) return;
  if (!Number.isFinite(value) || value < 0 || (maximum !== undefined && value > maximum)) {
    const range = maximum === undefined ? "finite and non-negative" : `finite and between 0 and ${maximum}`;
    throw new Error(`${name} must be ${range}`);
  }
}

function missingValues<T extends string>(expected: readonly T[], observed: readonly T[]): T[] {
  const observedSet = new Set(observed);
  return expected.filter((value) => !observedSet.has(value));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function evaluateRagProgrammeCase(input: RagProgrammeEvaluationCase): RagProgrammeCaseResult {
  const { diagnostics, expectation } = input;
  if (!Number.isInteger(diagnostics.directEvidenceSubquestionCount) || diagnostics.directEvidenceSubquestionCount < 0) {
    throw new Error("directEvidenceSubquestionCount must be a non-negative integer");
  }
  assertNonNegativeFinite("documentReciprocalRank", diagnostics.documentReciprocalRank, 1);
  assertNonNegativeFinite("contentReciprocalRank", diagnostics.contentReciprocalRank, 1);
  assertNonNegativeFinite("totalLatencyMs", diagnostics.totalLatencyMs);
  assertNonNegativeFinite("estimatedCostUsd", diagnostics.estimatedCostUsd);

  const failedExpectations: string[] = [];
  const hardViolations = [...diagnostics.hardViolations];
  for (const value of missingValues(expectation.expectedCorpusScopes, diagnostics.observedCorpusScopes)) {
    failedExpectations.push(`corpus_scope:${value}`);
  }
  for (const value of missingValues(expectation.expectedSourceRoles, diagnostics.observedSourceRoles)) {
    failedExpectations.push(`source_role:${value}`);
    hardViolations.push("source_role_mismatch");
  }
  for (const value of missingValues(expectation.expectedSiteDomains, diagnostics.observedSiteDomains)) {
    failedExpectations.push(`site_domain:${value}`);
    hardViolations.push("site_domain_miss");
  }
  if (expectation.expectedPublicSiteContentState !== diagnostics.publicSiteContentState) {
    failedExpectations.push(`site_content_state:${expectation.expectedPublicSiteContentState}`);
    if (diagnostics.publicSiteContentState === "stale") hardViolations.push("stale_site_content");
  }
  for (const value of missingValues(expectation.expectedSubquestionPurposes, diagnostics.directSubquestionPurposes)) {
    failedExpectations.push(`subquestion_purpose:${value}`);
  }
  if (diagnostics.directEvidenceSubquestionCount < expectation.minimumDirectSubquestions) {
    failedExpectations.push("minimum_direct_subquestions");
  }
  if (!expectation.allowedAnswerShapes.includes(diagnostics.answerShape)) failedExpectations.push("answer_shape");
  if (expectation.requireSupportedPart && !diagnostics.supportedPartRetained) {
    failedExpectations.push("supported_part_retained");
  }
  if (expectation.requireExactGap && !diagnostics.exactGapNamed) failedExpectations.push("exact_gap_named");
  if (
    diagnostics.insufficiencyReason !== null &&
    expectation.forbiddenFallbackReasons.includes(diagnostics.insufficiencyReason)
  ) {
    failedExpectations.push(`fallback_reason:${diagnostics.insufficiencyReason}`);
  }
  if (expectation.expectedConflict) {
    const observedConflict = diagnostics.observedConflict;
    const missingFields = missingValues(
      expectation.expectedConflict.requireVisibleFields,
      observedConflict?.visibleFields ?? [],
    );
    failedExpectations.push(...missingFields);
    if (observedConflict?.localDocumentId !== expectation.expectedConflict.localDocumentId) {
      failedExpectations.push("local_document_id");
    }
    if (observedConflict?.australianDocumentId !== expectation.expectedConflict.australianDocumentId) {
      failedExpectations.push("australian_document_id");
    }
    if (
      missingFields.length > 0 ||
      observedConflict?.localDocumentId !== expectation.expectedConflict.localDocumentId ||
      observedConflict?.australianDocumentId !== expectation.expectedConflict.australianDocumentId
    ) {
      hardViolations.push("conflict_contract");
    }
  }
  for (const value of missingValues(expectation.requiredFacts, diagnostics.requiredFactsPresent)) {
    failedExpectations.push(`required_fact:${value}`);
  }
  const forbiddenFound = new Set(diagnostics.forbiddenPatternsFound);
  for (const value of expectation.forbiddenPatterns) {
    if (forbiddenFound.has(value)) failedExpectations.push(`forbidden_pattern:${value}`);
  }
  if (input.expectedDocuments.length > 0 && diagnostics.documentReciprocalRank === 0) {
    failedExpectations.push("expected_document_not_retrieved");
  }
  if (expectation.requiredFacts.length > 0 && diagnostics.contentReciprocalRank === 0) {
    failedExpectations.push("expected_content_not_retrieved");
  }

  const validSupportedPartial =
    diagnostics.answerShape === "partial" && diagnostics.supportedPartRetained && diagnostics.exactGapNamed;
  const falseInsufficiency =
    diagnostics.insufficiencyReason !== null &&
    expectation.minimumDirectSubquestions > 0 &&
    diagnostics.directEvidenceSubquestionCount >= expectation.minimumDirectSubquestions &&
    !validSupportedPartial;
  if (falseInsufficiency) failedExpectations.push("false_insufficiency");

  const stableFailures = unique(failedExpectations);
  const stableViolations = unique(hardViolations);
  return {
    id: input.id,
    caseFingerprint: input.caseFingerprint,
    passed: stableFailures.length === 0 && stableViolations.length === 0,
    falseInsufficiency,
    supportedPartRetained: diagnostics.supportedPartRetained,
    documentReciprocalRank: diagnostics.documentReciprocalRank,
    contentReciprocalRank: diagnostics.contentReciprocalRank,
    hardViolations: stableViolations,
    failedExpectations: stableFailures,
    totalLatencyMs: diagnostics.totalLatencyMs,
    estimatedCostUsd: diagnostics.estimatedCostUsd,
  };
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

function artifactValidationFailures(
  artifact: RagProgrammeEvalArtifact,
  label: string,
  options: { enforceLatencyBudgets: boolean },
): string[] {
  const failures: string[] = [];
  if (artifact.schemaVersion !== 1) failures.push(`${label}:schema_version`);
  if (!/^[0-9a-f]{40}$/i.test(artifact.evaluatedGitSha)) failures.push(`${label}:evaluated_git_sha`);
  const populationInput = {
    sourcePolicyVersion: artifact.sourcePolicyVersion,
    indexGeneration: artifact.indexGeneration,
    siteContentRegistryVersion: artifact.siteContentRegistryVersion,
    publicSiteContentReleaseId: artifact.publicSiteContentReleaseId,
    publicSiteContentStaticManifestDigest: artifact.publicSiteContentStaticManifestDigest,
    publicSiteContentDynamicStateDigest: artifact.publicSiteContentDynamicStateDigest,
    publicSiteContentReleaseDigest: artifact.publicSiteContentReleaseDigest,
    publicSiteContentState: artifact.publicSiteContentState,
    publicSiteContentSnapshotFingerprint: artifact.publicSiteContentSnapshotFingerprint,
  };
  const invalidPopulationFields = populationInputFailures(populationInput);
  for (const field of invalidPopulationFields) failures.push(`${label}:invalid_population_field:${field}`);
  if (invalidPopulationFields.length === 0) {
    const expectedPopulationFingerprint = fingerprintRagProgrammePopulation(populationInput);
    if (artifact.populationFingerprint !== expectedPopulationFingerprint) {
      failures.push(`${label}:invalid_population_fingerprint`);
    }
  }
  if (artifact.caseSetFingerprint !== ragProgrammeFixture.caseSetFingerprint) {
    failures.push(`${label}:noncanonical_case_set_fingerprint`);
  }

  const canonicalById = new Map(ragProgrammeFixture.cases.map((testCase) => [testCase.id, testCase]));
  const ids = artifact.cases.map((testCase) => testCase.id);
  if (new Set(ids).size !== ids.length) failures.push(`${label}:duplicate_case_id`);
  const resultById = new Map(artifact.cases.map((testCase) => [testCase.id, testCase]));
  for (const id of canonicalById.keys()) {
    if (!resultById.has(id)) failures.push(`${label}:missing_canonical_case:${id}`);
  }
  for (const id of resultById.keys()) {
    if (!canonicalById.has(id)) failures.push(`${label}:unexpected_case:${id}`);
  }

  const metrics: Array<[string, number | null, number | undefined]> = [
    ["document_recall", artifact.aggregates.documentRecall, 1],
    ["content_recall", artifact.aggregates.contentRecall, 1],
    ["false_insufficiency_rate", artifact.aggregates.falseInsufficiencyRate, 1],
    ["supported_part_retention_rate", artifact.aggregates.supportedPartRetentionRate, 1],
    ["p95_total_latency_ms", artifact.aggregates.p95TotalLatencyMs, undefined],
    ["estimated_cost_usd", artifact.aggregates.estimatedCostUsd, undefined],
  ];
  for (const [name, value, maximum] of metrics) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || (maximum !== undefined && value > maximum))) {
      failures.push(`${label}:invalid_${name}`);
    }
  }

  let documentEligible = 0;
  let documentHits = 0;
  let contentEligible = 0;
  let contentHits = 0;
  let falseInsufficiencyEligible = 0;
  let falseInsufficiencyCount = 0;
  let retentionEligible = 0;
  let retentionHits = 0;
  const latencies: number[] = [];
  const costs: number[] = [];
  let completeCosts = true;

  for (const canonicalCase of ragProgrammeFixture.cases) {
    const testCase = resultById.get(canonicalCase.id);
    if (!testCase) continue;
    if (testCase.caseFingerprint !== canonicalCase.caseFingerprint) {
      failures.push(`${label}:${testCase.id}:noncanonical_case_fingerprint`);
    }
    if (!Array.isArray(testCase.failedExpectations) || !Array.isArray(testCase.hardViolations)) {
      failures.push(`${label}:${testCase.id}:invalid_verdict_arrays`);
      continue;
    }
    for (const [name, value, maximum] of [
      ["document_reciprocal_rank", testCase.documentReciprocalRank, 1],
      ["content_reciprocal_rank", testCase.contentReciprocalRank, 1],
      ["total_latency_ms", testCase.totalLatencyMs, undefined],
      ["estimated_cost_usd", testCase.estimatedCostUsd, undefined],
    ] as const) {
      if (value !== null && (!Number.isFinite(value) || value < 0 || (maximum !== undefined && value > maximum))) {
        failures.push(`${label}:${testCase.id}:invalid_${name}`);
      }
    }

    const documentMissing = canonicalCase.expectedDocuments.length > 0 && testCase.documentReciprocalRank === 0;
    const contentMissing = canonicalCase.expectation.requiredFacts.length > 0 && testCase.contentReciprocalRank === 0;
    const supportMissing = canonicalCase.expectation.requireSupportedPart && !testCase.supportedPartRetained;
    const expectedFailureFacts: Array<[boolean, string]> = [
      [documentMissing, "expected_document_not_retrieved"],
      [contentMissing, "expected_content_not_retrieved"],
      [supportMissing, "supported_part_retained"],
      [testCase.falseInsufficiency, "false_insufficiency"],
    ];
    for (const [expected, reason] of expectedFailureFacts) {
      if (testCase.failedExpectations.includes(reason) !== expected) {
        failures.push(`${label}:${testCase.id}:inconsistent_${reason}`);
      }
    }
    const derivedPassed = testCase.failedExpectations.length === 0 && testCase.hardViolations.length === 0;
    if (testCase.passed !== derivedPassed) failures.push(`${label}:${testCase.id}:inconsistent_passed`);

    if (canonicalCase.expectedDocuments.length > 0) {
      documentEligible += 1;
      if (testCase.documentReciprocalRank > 0) documentHits += 1;
    }
    if (canonicalCase.expectation.requiredFacts.length > 0) {
      contentEligible += 1;
      if (testCase.contentReciprocalRank > 0) contentHits += 1;
    }
    if (canonicalCase.expectation.minimumDirectSubquestions > 0) {
      falseInsufficiencyEligible += 1;
      if (testCase.falseInsufficiency) falseInsufficiencyCount += 1;
    }
    if (canonicalCase.expectation.requireSupportedPart) {
      retentionEligible += 1;
      if (testCase.supportedPartRetained) retentionHits += 1;
    }
    if (testCase.totalLatencyMs === null) {
      failures.push(`${label}:${testCase.id}:missing_total_latency_ms`);
    } else {
      latencies.push(testCase.totalLatencyMs);
      if (options.enforceLatencyBudgets && testCase.totalLatencyMs > canonicalCase.latencyTargetMs) {
        failures.push(`${label}:${testCase.id}:latency_budget`);
      }
    }
    if (testCase.estimatedCostUsd === null) completeCosts = false;
    else costs.push(testCase.estimatedCostUsd);
  }

  if (resultById.size === canonicalById.size && ragProgrammeFixture.cases.every(({ id }) => resultById.has(id))) {
    const derivedAggregates = {
      documentRecall: documentEligible === 0 ? 1 : documentHits / documentEligible,
      contentRecall: contentEligible === 0 ? 1 : contentHits / contentEligible,
      falseInsufficiencyRate:
        falseInsufficiencyEligible === 0 ? 0 : falseInsufficiencyCount / falseInsufficiencyEligible,
      supportedPartRetentionRate: retentionEligible === 0 ? 1 : retentionHits / retentionEligible,
      p95TotalLatencyMs: percentile95(latencies),
      estimatedCostUsd: completeCosts ? costs.reduce((total, value) => total + value, 0) : null,
    };
    for (const key of [
      "documentRecall",
      "contentRecall",
      "falseInsufficiencyRate",
      "supportedPartRetentionRate",
      "p95TotalLatencyMs",
    ] as const) {
      if (!nearlyEqual(artifact.aggregates[key], derivedAggregates[key])) {
        failures.push(`${label}:inconsistent_aggregate:${key}`);
      }
    }
    if (
      artifact.aggregates.estimatedCostUsd !== derivedAggregates.estimatedCostUsd &&
      (artifact.aggregates.estimatedCostUsd === null ||
        derivedAggregates.estimatedCostUsd === null ||
        !nearlyEqual(artifact.aggregates.estimatedCostUsd, derivedAggregates.estimatedCostUsd))
    ) {
      failures.push(`${label}:inconsistent_aggregate:estimatedCostUsd`);
    }
  }
  return failures;
}

const POPULATION_FIELDS: Array<keyof RagProgrammePopulationFingerprintInput> = [
  "sourcePolicyVersion",
  "indexGeneration",
  "siteContentRegistryVersion",
  "publicSiteContentReleaseId",
  "publicSiteContentStaticManifestDigest",
  "publicSiteContentDynamicStateDigest",
  "publicSiteContentReleaseDigest",
  "publicSiteContentState",
  "publicSiteContentSnapshotFingerprint",
];

export function compareRagProgrammeRuns(
  baseline: RagProgrammeEvalArtifact,
  candidate: RagProgrammeEvalArtifact,
  policy: RagProgrammeGatePolicy = RAG_PROGRAMME_GATE_POLICY,
): RagProgrammeComparison {
  const reasons = [
    ...artifactValidationFailures(baseline, "baseline", { enforceLatencyBudgets: false }),
    ...artifactValidationFailures(candidate, "candidate", { enforceLatencyBudgets: true }),
  ];
  if (baseline.evaluationVariant !== "legacy") reasons.push("baseline:variant_must_be_legacy");
  if (candidate.evaluationVariant !== "candidate") reasons.push("candidate:variant_must_be_candidate");
  if (baseline.evaluatedGitSha !== candidate.evaluatedGitSha) reasons.push("evaluated_git_sha_mismatch");
  if (baseline.caseSetFingerprint !== candidate.caseSetFingerprint) reasons.push("case_set_fingerprint_mismatch");
  if (baseline.populationFingerprint !== candidate.populationFingerprint)
    reasons.push("population_fingerprint_mismatch");
  for (const field of POPULATION_FIELDS) {
    if (baseline[field] !== candidate[field]) reasons.push(`population_field_mismatch:${field}`);
  }

  const baselineById = new Map(baseline.cases.map((testCase) => [testCase.id, testCase]));
  const candidateById = new Map(candidate.cases.map((testCase) => [testCase.id, testCase]));
  for (const id of baselineById.keys()) if (!candidateById.has(id)) reasons.push(`candidate:missing_case:${id}`);
  for (const id of candidateById.keys()) if (!baselineById.has(id)) reasons.push(`candidate:unexpected_case:${id}`);

  let rankRegressions = 0;
  for (const [id, candidateCase] of candidateById) {
    const baselineCase = baselineById.get(id);
    if (!baselineCase) continue;
    if (candidateCase.caseFingerprint !== baselineCase.caseFingerprint) reasons.push(`case_fingerprint_mismatch:${id}`);
    if (candidateCase.passed !== true || candidateCase.failedExpectations.length > 0) {
      reasons.push(`candidate:must_pass_case_failed:${id}`);
    }
    if (candidateCase.hardViolations.length > policy.maximumHardViolations) {
      reasons.push(`candidate:hard_violation:${id}`);
    }
    if (candidateCase.falseInsufficiency) reasons.push(`candidate:false_insufficiency:${id}`);
    if (candidateCase.documentReciprocalRank < baselineCase.documentReciprocalRank) rankRegressions += 1;
    if (candidateCase.contentReciprocalRank < baselineCase.contentReciprocalRank) rankRegressions += 1;
  }
  if (rankRegressions > policy.maximumPerCaseRankRegressions) reasons.push("candidate:per_case_rank_regression");

  if (candidate.aggregates.documentRecall < policy.requireDocumentRecall) reasons.push("candidate:document_recall");
  if (candidate.aggregates.contentRecall < policy.requireContentRecall) reasons.push("candidate:content_recall");
  if (candidate.aggregates.supportedPartRetentionRate < 1) reasons.push("candidate:supported_part_retention");
  if (
    (baseline.aggregates.falseInsufficiencyRate === 0 && candidate.aggregates.falseInsufficiencyRate !== 0) ||
    (baseline.aggregates.falseInsufficiencyRate > 0 &&
      candidate.aggregates.falseInsufficiencyRate >= baseline.aggregates.falseInsufficiencyRate)
  ) {
    reasons.push("candidate:false_insufficiency_not_improved");
  }
  if (
    candidate.aggregates.p95TotalLatencyMs >
    baseline.aggregates.p95TotalLatencyMs * policy.maximumP95LatencyMultiplier
  ) {
    reasons.push("candidate:p95_latency_regression");
  }
  if (
    baseline.aggregates.estimatedCostUsd !== null &&
    candidate.aggregates.estimatedCostUsd !== null &&
    candidate.aggregates.estimatedCostUsd > baseline.aggregates.estimatedCostUsd * policy.maximumEstimatedCostMultiplier
  ) {
    reasons.push("candidate:estimated_cost_regression");
  }

  const stableReasons = unique(reasons);
  return { decision: stableReasons.length === 0 ? "GO" : "NO_GO", reasons: stableReasons };
}
