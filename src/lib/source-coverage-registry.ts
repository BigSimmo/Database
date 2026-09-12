import { assertNoIngestionCredentialShape, parseIngestionAuditIdentifier } from "./ingestion-audit";

export type ExpectedSourceCoverageRecord = Readonly<{
  key: string;
  owner: string;
  reviewStatus: "active" | "absent" | "not_approved" | "retired";
  expectedDocumentIds: readonly string[];
  mustPassCaseIds: readonly string[];
  caseExpectations: readonly Readonly<{ caseId: string; expectedDocumentIds: readonly string[] }>[];
}>;

export type SourceCoverageFinding = Readonly<{
  key: string;
  outcome: "available" | "not_in_corpus" | "retrieval_miss" | "not_approved" | "retired";
  owner: string;
  mustPassCaseIds: readonly string[];
}>;

type CatalogueEntry = { key: string; contentMode: string; licencePolicy: string; lifecycle: string };
type EvaluationCase = { id: string; expectedDocuments: readonly string[] };
export type ExpectedSourceCoverageRegistry = Readonly<{
  schemaVersion: 1;
  records: readonly ExpectedSourceCoverageRecord[];
}>;

const MAX_RECORDS = 500;
const MAX_IDS = 500;
const statuses = new Set(["active", "absent", "not_approved", "retired"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field ${unexpected.sort()[0]}.`);
}

function stringIds(value: unknown, label: string, kind: "document" | "case") {
  if (!Array.isArray(value) || value.length > MAX_IDS) throw new Error(`${label} must be a bounded array.`);
  const ids = value.map((item, index) => parseIngestionAuditIdentifier(item, kind, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains a duplicate identifier.`);
  return ids.sort();
}

type CoverageOwnershipRecord = Pick<ExpectedSourceCoverageRecord, "key" | "expectedDocumentIds" | "mustPassCaseIds">;

function validateGlobalCoverageOwnership(records: readonly CoverageOwnershipRecord[]) {
  const keys = new Set<string>();
  const claimedDocuments = new Set<string>();
  const claimedCases = new Set<string>();
  for (const entry of records) {
    if (keys.has(entry.key)) throw new Error(`Duplicate expected source key: ${entry.key}.`);
    keys.add(entry.key);
    for (const documentId of entry.expectedDocumentIds) {
      if (claimedDocuments.has(documentId)) throw new Error(`Duplicate expected document ownership: ${documentId}.`);
      claimedDocuments.add(documentId);
    }
    for (const caseId of entry.mustPassCaseIds) {
      if (claimedCases.has(caseId)) throw new Error(`Duplicate must-pass case ownership: ${caseId}.`);
      claimedCases.add(caseId);
    }
  }
}

export function parseExpectedSourceCoverageRegistry(
  value: unknown,
  references: { catalogue: readonly CatalogueEntry[]; evaluationCases: readonly EvaluationCase[] },
): ExpectedSourceCoverageRegistry {
  const root = record(value, "Expected source coverage registry");
  exactKeys(root, ["schemaVersion", "records"], "Expected source coverage registry");
  if (root.schemaVersion !== 1) throw new Error("Expected source coverage registry schemaVersion must be 1.");
  if (!Array.isArray(root.records) || root.records.length > MAX_RECORDS)
    throw new Error("Expected source coverage records must be a bounded array.");
  const catalogueByKey = new Map(references.catalogue.map((entry) => [entry.key, entry]));
  const casesById = new Map(references.evaluationCases.map((testCase) => [testCase.id, testCase]));
  const records = root.records.map((item, index): ExpectedSourceCoverageRecord => {
    const raw = record(item, `records[${index}]`);
    exactKeys(raw, ["key", "owner", "reviewStatus", "expectedDocumentIds", "mustPassCaseIds"], `records[${index}]`);
    const key = parseIngestionAuditIdentifier(raw.key, "source key", `records[${index}].key`);
    const owner = raw.owner;
    assertNoIngestionCredentialShape(owner, `records[${index}].owner`);
    const catalogue = catalogueByKey.get(key);
    if (!catalogue) throw new Error(`Unknown expected source key: ${key}.`);
    if (owner !== `source_governance:${key}`) throw new Error(`${key}.owner must be source_governance:${key}.`);
    if (typeof raw.reviewStatus !== "string" || !statuses.has(raw.reviewStatus))
      throw new Error(`Invalid reviewStatus for ${key}.`);
    const reviewStatus = raw.reviewStatus as ExpectedSourceCoverageRecord["reviewStatus"];
    if (
      reviewStatus === "active" &&
      (catalogue.contentMode === "link_only" || catalogue.licencePolicy === "index_forbidden")
    )
      throw new Error(`${key} is link-only or index-forbidden and cannot be active.`);
    if (reviewStatus === "active" && catalogue.lifecycle !== "active")
      throw new Error(`${key} is not an active catalogue source.`);
    const expectedDocumentIds = stringIds(raw.expectedDocumentIds, `${key}.expectedDocumentIds`, "document");
    const mustPassCaseIds = stringIds(raw.mustPassCaseIds, `${key}.mustPassCaseIds`, "case");
    const mappedCases: EvaluationCase[] = [];
    for (const caseId of mustPassCaseIds) {
      const testCase = casesById.get(caseId);
      if (!testCase) throw new Error(`Unknown evaluation case: ${caseId}.`);
      if (!testCase.expectedDocuments.some((documentId) => expectedDocumentIds.includes(documentId)))
        throw new Error(`${caseId} expected document mapping disagrees with the evaluation registry.`);
      mappedCases.push(testCase);
    }
    if (
      expectedDocumentIds.some(
        (documentId) => !mappedCases.some((testCase) => testCase.expectedDocuments.includes(documentId)),
      )
    )
      throw new Error(`${key} expected document mapping disagrees with the evaluation registry.`);
    const caseExpectations = mappedCases.map((testCase) => ({
      caseId: testCase.id,
      expectedDocumentIds: expectedDocumentIds.filter((documentId) => testCase.expectedDocuments.includes(documentId)),
    }));
    return { key, owner, reviewStatus, expectedDocumentIds, mustPassCaseIds, caseExpectations };
  });
  validateGlobalCoverageOwnership(records);
  const keys = new Set(records.map(({ key }) => key));
  const missingCatalogueKeys = references.catalogue.map(({ key }) => key).filter((key) => !keys.has(key));
  if (missingCatalogueKeys.length)
    throw new Error(`Expected source registry is missing catalogue key ${missingCatalogueKeys.sort()[0]}.`);
  return { schemaVersion: 1, records: records.sort((left, right) => left.key.localeCompare(right.key)) };
}

export function auditExpectedSourceCoverage(args: {
  expected: readonly ExpectedSourceCoverageRecord[];
  activeDocumentIds: ReadonlySet<string>;
  retrievedDocumentIdsByCase: ReadonlyMap<string, ReadonlySet<string>>;
}): readonly SourceCoverageFinding[] {
  const validated = [...args.expected].map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Expected source record must be an object.");
    const key = parseIngestionAuditIdentifier(entry.key, "source key", "expected source key");
    assertNoIngestionCredentialShape(entry.owner, "expected source owner");
    if (entry.owner !== `source_governance:${key}`)
      throw new Error("Expected source owner must match its controlled source-governance identifier.");
    if (!statuses.has(entry.reviewStatus)) throw new Error("Expected source review status is invalid.");
    if (
      !Array.isArray(entry.expectedDocumentIds) ||
      !Array.isArray(entry.mustPassCaseIds) ||
      entry.expectedDocumentIds.length > MAX_IDS ||
      entry.mustPassCaseIds.length > MAX_IDS
    )
      throw new Error("Expected source identifier arrays must be bounded.");
    const expectedDocumentIds = entry.expectedDocumentIds.map((documentId) =>
      parseIngestionAuditIdentifier(documentId, "document", "expected document id"),
    );
    const mustPassCaseIds = entry.mustPassCaseIds.map((caseId) =>
      parseIngestionAuditIdentifier(caseId, "case", "must-pass case id"),
    );
    if (
      new Set(expectedDocumentIds).size !== expectedDocumentIds.length ||
      new Set(mustPassCaseIds).size !== mustPassCaseIds.length
    )
      throw new Error("Expected source record contains duplicate identifiers.");
    if (!Array.isArray(entry.caseExpectations) || entry.caseExpectations.length > MAX_IDS)
      throw new Error("Expected source record has an invalid case expectation mapping.");
    const expectedByCase = new Map(
      entry.caseExpectations.map((caseExpectation) => {
        if (!caseExpectation || typeof caseExpectation !== "object")
          throw new Error("Expected source record has an invalid case expectation mapping.");
        const { caseId, expectedDocumentIds: expectedForCase } = caseExpectation;
        const validatedCaseId = parseIngestionAuditIdentifier(caseId, "case", "case expectation id");
        if (!Array.isArray(expectedForCase) || expectedForCase.length === 0 || expectedForCase.length > MAX_IDS)
          throw new Error("Expected source record has an invalid case expectation mapping.");
        const validatedDocuments = expectedForCase.map((documentId) =>
          parseIngestionAuditIdentifier(documentId, "document", "case expectation document id"),
        );
        if (
          new Set(validatedDocuments).size !== validatedDocuments.length ||
          validatedDocuments.some((documentId) => !expectedDocumentIds.includes(documentId))
        )
          throw new Error("Expected source record has an invalid case expectation mapping.");
        return [validatedCaseId, validatedDocuments] as const;
      }),
    );
    const mappedDocumentIds = new Set([...expectedByCase.values()].flat());
    if (
      expectedByCase.size !== entry.caseExpectations.length ||
      mustPassCaseIds.some((caseId) => !expectedByCase.has(caseId)) ||
      [...expectedByCase.keys()].some((caseId) => !mustPassCaseIds.includes(caseId)) ||
      expectedDocumentIds.some((documentId) => !mappedDocumentIds.has(documentId)) ||
      [...mappedDocumentIds].some((documentId) => !expectedDocumentIds.includes(documentId))
    ) {
      throw new Error("Expected source record has an invalid case expectation mapping.");
    }
    return { entry, key, expectedDocumentIds, mustPassCaseIds, expectedByCase };
  });
  validateGlobalCoverageOwnership(validated);
  return validated
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({ entry, key, expectedDocumentIds, mustPassCaseIds, expectedByCase }) => {
      let outcome: SourceCoverageFinding["outcome"];
      if (entry.reviewStatus === "retired") outcome = "retired";
      else if (entry.reviewStatus === "not_approved") outcome = "not_approved";
      else {
        const allExpectedActive =
          entry.reviewStatus === "active" &&
          expectedDocumentIds.length > 0 &&
          expectedDocumentIds.every((documentId) => args.activeDocumentIds.has(documentId));
        if (!allExpectedActive) outcome = "not_in_corpus";
        else {
          const retrievalMiss = mustPassCaseIds.some((caseId) => {
            const retrieved = args.retrievedDocumentIdsByCase.get(caseId);
            const expectedForCase = expectedByCase.get(caseId)!;
            return !retrieved || expectedForCase.some((documentId) => !retrieved.has(documentId));
          });
          outcome = retrievalMiss ? "retrieval_miss" : "available";
        }
      }
      return { key, outcome, owner: entry.owner, mustPassCaseIds: [...mustPassCaseIds].sort() };
    });
}
