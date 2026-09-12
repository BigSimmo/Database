import { createHash } from "node:crypto";

export type IngestionAuditAction = "no_change" | "metadata_only" | "targeted_reprocess" | "shadow_reindex";
export type IngestionAuditReason =
  | "integrity_expectation_missing"
  | "metadata_incomplete"
  | "source_governance_invalid"
  | "withdrawn_or_superseded"
  | "missing_pages"
  | "missing_chunks"
  | "missing_tables"
  | "missing_images"
  | "missing_searchable_units"
  | "duplicate_chunks"
  | "orphaned_artifacts"
  | "empty_index_units"
  | "oversized_index_units"
  | "undersized_index_units"
  | "low_information_index_units"
  | "chunk_bounds_invalid"
  | "heading_continuity_failed"
  | "table_continuity_failed"
  | "extraction_quality_poor"
  | "embedding_missing_or_mismatched"
  | "generation_incomplete"
  | "must_pass_retrieval_failed";

export type ExpectedActualCount = { expected: number | null; actual: number };

export type IngestionAuditIdentifierKind =
  "source key" | "registry record" | "document" | "generation" | "case" | "policy" | "model" | "strategy";

const IDENTIFIER_LIMITS: Readonly<Record<IngestionAuditIdentifierKind, number>> = {
  "source key": 100,
  "registry record": 128,
  document: 128,
  generation: 128,
  case: 128,
  policy: 80,
  model: 100,
  strategy: 64,
};
const ASCII_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ASCII_STRATEGY = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const POLICY_VERSION = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-v[1-9][0-9]*$/;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_IDENTITY_KINDS = new Set<IngestionAuditIdentifierKind>(["document", "generation", "registry record"]);
const CREDENTIAL_PREFIX =
  /^(?:(?:sk|pk)[-_:][a-z0-9]|sb[-_:](?:secret|publishable)|gh[pousr]_|github_pat_|xox[baprs]-|akia[0-9a-z]|(?:api[-_:]?key|key|token|secret|password|passwd|bearer|credential)(?=$|[\s\-_:=]))/i;
const CREDENTIAL_SEGMENT =
  /(?:^|[\s\-_:=])(?:api[-_:]?key|access[-_:]?token|refresh[-_:]?token|service[-_:]?role[-_:]?key|private[-_:]?key|token|secret|password|passwd|bearer|credential)(?=$|[\s\-_:=])/i;
const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;

export function assertNoIngestionCredentialShape(value: unknown, label: string): void {
  if (
    typeof value === "string" &&
    (CREDENTIAL_PREFIX.test(value) || CREDENTIAL_SEGMENT.test(value) || JWT_SHAPE.test(value))
  )
    throw new Error(`${label} contains a credential-shaped value.`);
}

export function parseIngestionAuditIdentifier(
  value: unknown,
  kind: IngestionAuditIdentifierKind,
  label: string,
): string {
  assertNoIngestionCredentialShape(value, label);
  const pattern = kind === "strategy" ? ASCII_STRATEGY : kind === "policy" ? POLICY_VERSION : ASCII_SLUG;
  if (typeof value === "string" && CANONICAL_UUID.test(value) && UUID_IDENTITY_KINDS.has(kind)) return value;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_LIMITS[kind] ||
    !pattern.test(value) ||
    UUID_SHAPE.test(value)
  ) {
    throw new Error(`${label} must be a bounded ASCII identifier for ${kind}.`);
  }
  return value;
}

export const INGESTION_FAILED_EXPECTATION_CODES = [
  "answer_shape",
  "australian_document_id",
  "corpus_scope",
  "exact_gap_named",
  "expected_content_not_retrieved",
  "expected_document_not_retrieved",
  "fallback_reason",
  "false_insufficiency",
  "forbidden_pattern",
  "jurisdiction",
  "local_document_id",
  "local_primary_decision",
  "material_difference",
  "minimum_direct_subquestions",
  "publication_or_effective_date",
  "required_fact",
  "review_flag",
  "site_content_state",
  "site_domain",
  "source_identity",
  "source_role",
  "subquestion_purpose",
  "supported_part_retained",
] as const;

export type IngestionFailedExpectationCode = (typeof INGESTION_FAILED_EXPECTATION_CODES)[number];

export type IngestionMustPassCaseInput = {
  id: string;
  passed: boolean;
  expectedDocumentRank: number | null;
  actualDocumentRank: number | null;
  failedExpectations: string[];
};

export type IngestionMustPassCase = Omit<IngestionMustPassCaseInput, "failedExpectations"> & {
  failedExpectations: IngestionFailedExpectationCode[];
};

const FAILED_EXPECTATION_CODES = new Set<string>(INGESTION_FAILED_EXPECTATION_CODES);
const SUFFIXED_FAILED_EXPECTATION_CATEGORIES = new Set<IngestionFailedExpectationCode>([
  "corpus_scope",
  "fallback_reason",
  "forbidden_pattern",
  "required_fact",
  "site_content_state",
  "site_domain",
  "source_role",
  "subquestion_purpose",
]);
const CANONICAL_REASON_VALUE = /^[a-z][a-z0-9_]{0,119}$/;

export function normalizeIngestionFailedExpectationCodes(values: readonly string[]): IngestionFailedExpectationCode[] {
  const normalized = values.map((value): IngestionFailedExpectationCode => {
    assertNoIngestionCredentialShape(value, "Failed expectation code");
    if (FAILED_EXPECTATION_CODES.has(value)) return value as IngestionFailedExpectationCode;
    const separator = value.indexOf(":");
    const category = value.slice(0, separator) as IngestionFailedExpectationCode;
    const suffix = value.slice(separator + 1);
    if (separator > 0 && SUFFIXED_FAILED_EXPECTATION_CATEGORIES.has(category) && CANONICAL_REASON_VALUE.test(suffix)) {
      return category;
    }
    throw new Error("Unsupported failed expectation code.");
  });
  return [...new Set(normalized)].sort();
}

export type IngestionIntegrityExpectation = {
  pages: number | null;
  chunks: number | null;
  tables: number | null;
  images: number | null;
  searchableUnits: number | null;
  embeddings: number | null;
  unitQualityPolicyVersion: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingStrategy: string;
};

export type IngestionDocumentAuditInput = {
  documentId: string;
  fileName: string | null;
  metadata: unknown;
  registryProjection: boolean;
  integrityExpectation: IngestionIntegrityExpectation | null;
  activeGenerationId: string | null;
  lifecycle: "active" | "quarantined" | "withdrawn" | "superseded";
  governanceValid: boolean;
  publisher: string | null;
  pageCount: number | null;
  indexedPageCount: number | null;
  chunkCount: number;
  tableCount: number | null;
  imageCount: number | null;
  searchableUnitCount: number | null;
  embeddingCount: number;
  duplicateChunks: number;
  orphanedArtifacts: number;
  emptyIndexUnits: number;
  oversizedIndexUnits: number;
  undersizedIndexUnits: number;
  lowInformationIndexUnits: number;
  chunkBoundsValid: boolean | null;
  headingContinuityPassed: boolean | null;
  tableContinuityPassed: boolean | null;
  extractionQuality: "acceptable" | "poor" | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  embeddingStrategy: string | null;
  chunkGenerations: string[];
  mustPassCases: IngestionMustPassCaseInput[];
};

export type IngestionDocumentAudit = {
  documentId: string;
  expectedStateDigest: string;
  activeGenerationId: string | null;
  action: IngestionAuditAction;
  eligibleForShadowPlan: boolean;
  blockingDisposition: "quarantine_review" | "tombstone" | null;
  reasons: IngestionAuditReason[];
  counts: {
    pages: ExpectedActualCount;
    chunks: ExpectedActualCount;
    tables: ExpectedActualCount;
    images: ExpectedActualCount;
    searchableUnits: ExpectedActualCount;
    embeddings: ExpectedActualCount;
    duplicateChunks: number;
    orphanedArtifacts: number;
  };
  unitQuality: { policyVersion: string; empty: number; oversized: number; undersized: number; lowInformation: number };
  embeddingContract: {
    expectedModel: string;
    actualModels: string[];
    expectedDimensions: number;
    actualDimensions: number[];
    expectedStrategy: string;
    actualStrategies: string[];
    completeness: number;
  };
  mustPassCases: IngestionMustPassCase[];
};

const REASON_ORDER: readonly IngestionAuditReason[] = [
  "integrity_expectation_missing",
  "metadata_incomplete",
  "source_governance_invalid",
  "withdrawn_or_superseded",
  "missing_pages",
  "missing_chunks",
  "missing_tables",
  "missing_images",
  "missing_searchable_units",
  "duplicate_chunks",
  "orphaned_artifacts",
  "empty_index_units",
  "oversized_index_units",
  "undersized_index_units",
  "low_information_index_units",
  "chunk_bounds_invalid",
  "heading_continuity_failed",
  "table_continuity_failed",
  "extraction_quality_poor",
  "embedding_missing_or_mismatched",
  "generation_incomplete",
  "must_pass_retrieval_failed",
];

const TARGETED_REASONS = new Set<IngestionAuditReason>([
  "missing_pages",
  "missing_chunks",
  "missing_tables",
  "missing_images",
  "missing_searchable_units",
  "duplicate_chunks",
  "orphaned_artifacts",
  "empty_index_units",
  "oversized_index_units",
  "undersized_index_units",
  "low_information_index_units",
  "chunk_bounds_invalid",
  "heading_continuity_failed",
  "table_continuity_failed",
  "extraction_quality_poor",
]);
const SHADOW_REASONS = new Set<IngestionAuditReason>([
  "embedding_missing_or_mismatched",
  "generation_incomplete",
  "must_pass_retrieval_failed",
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function deterministicAuditDigest(value: unknown) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

export function auditDocument(input: IngestionDocumentAuditInput): IngestionDocumentAudit {
  parseIngestionAuditIdentifier(input.documentId, "document", "documentId");
  if (input.activeGenerationId !== null)
    parseIngestionAuditIdentifier(input.activeGenerationId, "generation", "activeGenerationId");
  for (const generation of input.chunkGenerations)
    parseIngestionAuditIdentifier(generation, "generation", "chunkGenerations item");
  if (input.integrityExpectation) {
    parseIngestionAuditIdentifier(
      input.integrityExpectation.unitQualityPolicyVersion,
      "policy",
      "integrity expectation policy version",
    );
    parseIngestionAuditIdentifier(input.integrityExpectation.embeddingModel, "model", "expected embedding model");
    parseIngestionAuditIdentifier(
      input.integrityExpectation.embeddingStrategy,
      "strategy",
      "expected embedding strategy",
    );
  }
  if (input.embeddingModel !== null)
    parseIngestionAuditIdentifier(input.embeddingModel, "model", "actual embedding model");
  if (input.embeddingStrategy !== null)
    parseIngestionAuditIdentifier(input.embeddingStrategy, "strategy", "actual embedding strategy");
  if (input.indexedPageCount === null) {
    throw new Error("Indexed page count measurement is required.");
  }
  if (input.tableCount === null) throw new Error("Table count measurement is required.");
  if (input.imageCount === null) throw new Error("Image count measurement is required.");
  if (input.searchableUnitCount === null) throw new Error("Searchable unit count measurement is required.");
  const caseIds = input.mustPassCases.map(({ id }) => parseIngestionAuditIdentifier(id, "case", "must-pass case id"));
  const duplicateCaseId = caseIds.filter((id, index) => caseIds.indexOf(id) !== index).sort()[0];
  if (duplicateCaseId) throw new Error(`Document ${input.documentId} contains duplicate case id ${duplicateCaseId}.`);
  const mustPassCases = input.mustPassCases
    .map((testCase) => {
      try {
        const normalized: IngestionMustPassCase = {
          id: testCase.id,
          passed: testCase.passed,
          expectedDocumentRank: testCase.expectedDocumentRank,
          actualDocumentRank: testCase.actualDocumentRank,
          failedExpectations: [...normalizeIngestionFailedExpectationCodes(testCase.failedExpectations)],
        };
        if (normalized.passed && normalized.failedExpectations.length > 0)
          throw new Error("A passed must-pass case cannot contain failed expectations.");
        return normalized;
      } catch {
        for (const failedExpectation of testCase.failedExpectations)
          assertNoIngestionCredentialShape(failedExpectation, "Failed expectation code");
        if (testCase.passed && testCase.failedExpectations.length > 0)
          throw new Error("A passed must-pass case cannot contain failed expectations.");
        throw new Error("Unsupported failed expectation code for must-pass case.");
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const expectation = input.integrityExpectation;
  const reasons = new Set<IngestionAuditReason>();
  if (!expectation) reasons.add("integrity_expectation_missing");
  if (!input.publisher?.trim()) reasons.add("metadata_incomplete");
  if (!input.governanceValid || input.lifecycle === "quarantined") reasons.add("source_governance_invalid");
  if (input.lifecycle === "withdrawn" || input.lifecycle === "superseded") reasons.add("withdrawn_or_superseded");

  if (!input.registryProjection) {
    const expectedPages = expectation?.pages ?? input.pageCount;
    if (expectedPages !== null && input.indexedPageCount < expectedPages) reasons.add("missing_pages");
    if (expectation?.chunks !== null && expectation?.chunks !== undefined && input.chunkCount < expectation.chunks)
      reasons.add("missing_chunks");
    if (expectation?.tables !== null && expectation?.tables !== undefined && input.tableCount < expectation.tables)
      reasons.add("missing_tables");
    if (expectation?.images !== null && expectation?.images !== undefined && input.imageCount < expectation.images)
      reasons.add("missing_images");
    if (
      expectation?.searchableUnits !== null &&
      expectation?.searchableUnits !== undefined &&
      input.searchableUnitCount < expectation.searchableUnits
    )
      reasons.add("missing_searchable_units");
    if (input.duplicateChunks > 0) reasons.add("duplicate_chunks");
    if (input.orphanedArtifacts > 0) reasons.add("orphaned_artifacts");
    if (input.emptyIndexUnits > 0) reasons.add("empty_index_units");
    if (input.oversizedIndexUnits > 0) reasons.add("oversized_index_units");
    if (input.undersizedIndexUnits > 0) reasons.add("undersized_index_units");
    if (input.lowInformationIndexUnits > 0) reasons.add("low_information_index_units");
    if (input.chunkBoundsValid === false) reasons.add("chunk_bounds_invalid");
    if (input.headingContinuityPassed === false) reasons.add("heading_continuity_failed");
    if (input.tableContinuityPassed === false) reasons.add("table_continuity_failed");
    if (input.extractionQuality === "poor") reasons.add("extraction_quality_poor");
  }

  const completeness =
    input.searchableUnitCount === 0 ? 1 : Math.min(input.embeddingCount / input.searchableUnitCount, 1);
  const generations = [...new Set(input.chunkGenerations)].sort();
  if (!input.registryProjection) {
    if (
      expectation &&
      (input.embeddingModel !== expectation.embeddingModel ||
        input.embeddingDimensions !== expectation.embeddingDimensions ||
        input.embeddingStrategy !== expectation.embeddingStrategy ||
        (expectation.embeddings !== null && input.embeddingCount !== expectation.embeddings) ||
        completeness < 1)
    ) {
      reasons.add("embedding_missing_or_mismatched");
    }
    if (
      input.activeGenerationId === null ||
      (input.chunkCount > 0 && generations.length === 0) ||
      generations.some((value) => value !== input.activeGenerationId)
    ) {
      reasons.add("generation_incomplete");
    }
    if (input.mustPassCases.some((testCase) => !testCase.passed)) reasons.add("must_pass_retrieval_failed");
  }

  const orderedReasons = REASON_ORDER.filter((reason) => reasons.has(reason));
  const action: IngestionAuditAction = orderedReasons.some((reason) => TARGETED_REASONS.has(reason))
    ? "targeted_reprocess"
    : orderedReasons.some((reason) => SHADOW_REASONS.has(reason))
      ? "shadow_reindex"
      : reasons.has("metadata_incomplete")
        ? "metadata_only"
        : "no_change";
  const blockingDisposition =
    input.lifecycle === "withdrawn" || input.lifecycle === "superseded"
      ? "tombstone"
      : !expectation || !input.governanceValid || input.lifecycle === "quarantined"
        ? "quarantine_review"
        : null;
  const digestState = {
    documentId: input.documentId,
    registryProjection: input.registryProjection,
    activeGenerationId: input.activeGenerationId,
    lifecycle: input.lifecycle,
    governanceValid: input.governanceValid,
    publisher: input.publisher,
    pageCount: input.pageCount,
    indexedPageCount: input.indexedPageCount,
    chunkCount: input.chunkCount,
    tableCount: input.tableCount,
    imageCount: input.imageCount,
    searchableUnitCount: input.searchableUnitCount,
    embeddingCount: input.embeddingCount,
    duplicateChunks: input.duplicateChunks,
    orphanedArtifacts: input.orphanedArtifacts,
    unitQuality: [
      input.emptyIndexUnits,
      input.oversizedIndexUnits,
      input.undersizedIndexUnits,
      input.lowInformationIndexUnits,
    ],
    continuities: [input.chunkBoundsValid, input.headingContinuityPassed, input.tableContinuityPassed],
    extractionQuality: input.extractionQuality,
    embedding: [input.embeddingModel, input.embeddingDimensions, input.embeddingStrategy],
    generations,
    expectation,
    mustPassCases,
  };
  return {
    documentId: input.documentId,
    expectedStateDigest: deterministicAuditDigest(digestState),
    activeGenerationId: input.activeGenerationId,
    action,
    eligibleForShadowPlan: blockingDisposition === null,
    blockingDisposition,
    reasons: orderedReasons,
    counts: {
      pages: { expected: expectation?.pages ?? input.pageCount, actual: input.indexedPageCount },
      chunks: { expected: expectation?.chunks ?? null, actual: input.chunkCount },
      tables: { expected: expectation?.tables ?? null, actual: input.tableCount },
      images: { expected: expectation?.images ?? null, actual: input.imageCount },
      searchableUnits: { expected: expectation?.searchableUnits ?? null, actual: input.searchableUnitCount },
      embeddings: { expected: expectation?.embeddings ?? null, actual: input.embeddingCount },
      duplicateChunks: input.duplicateChunks,
      orphanedArtifacts: input.orphanedArtifacts,
    },
    unitQuality: {
      policyVersion: expectation?.unitQualityPolicyVersion ?? "unreviewed",
      empty: input.emptyIndexUnits,
      oversized: input.oversizedIndexUnits,
      undersized: input.undersizedIndexUnits,
      lowInformation: input.lowInformationIndexUnits,
    },
    embeddingContract: {
      expectedModel: expectation?.embeddingModel ?? "unreviewed",
      actualModels: input.embeddingModel ? [input.embeddingModel] : [],
      expectedDimensions: expectation?.embeddingDimensions ?? 0,
      actualDimensions: input.embeddingDimensions === null ? [] : [input.embeddingDimensions],
      expectedStrategy: expectation?.embeddingStrategy ?? "unreviewed",
      actualStrategies: input.embeddingStrategy ? [input.embeddingStrategy] : [],
      completeness,
    },
    mustPassCases,
  };
}

export function assertAuditTargetState(
  audit: Pick<IngestionDocumentAudit, "expectedStateDigest">,
  actualStateDigest: string,
) {
  if (audit.expectedStateDigest !== actualStateDigest) {
    throw new Error("Audit target state digest changed between plan and apply.");
  }
}
