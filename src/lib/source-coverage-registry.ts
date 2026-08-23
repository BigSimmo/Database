export type ExpectedSourceCoverageRecord = Readonly<{
  key: string;
  owner: string;
  reviewStatus: "active" | "absent" | "not_approved" | "retired";
  expectedDocumentIds: readonly string[];
  mustPassCaseIds: readonly string[];
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
const expectedDocumentsByCase = new WeakMap<ExpectedSourceCoverageRecord, ReadonlyMap<string, readonly string[]>>();

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field ${unexpected.sort()[0]}.`);
}

function boundedString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error(`${label} must be a bounded string.`);
  return value.trim();
}

function stringIds(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > MAX_IDS) throw new Error(`${label} must be a bounded array.`);
  const ids = value.map((item, index) => boundedString(item, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains a duplicate identifier.`);
  return ids.sort();
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
  const keys = new Set<string>();
  const claimedDocuments = new Set<string>();
  const claimedCases = new Set<string>();
  const records = root.records.map((item, index): ExpectedSourceCoverageRecord => {
    const raw = record(item, `records[${index}]`);
    exactKeys(raw, ["key", "owner", "reviewStatus", "expectedDocumentIds", "mustPassCaseIds"], `records[${index}]`);
    const key = boundedString(raw.key, `records[${index}].key`);
    const owner = boundedString(raw.owner, `records[${index}].owner`);
    if (keys.has(key)) throw new Error(`Duplicate expected source key: ${key}.`);
    keys.add(key);
    const catalogue = catalogueByKey.get(key);
    if (!catalogue) throw new Error(`Unknown expected source key: ${key}.`);
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
    const expectedDocumentIds = stringIds(raw.expectedDocumentIds, `${key}.expectedDocumentIds`);
    const mustPassCaseIds = stringIds(raw.mustPassCaseIds, `${key}.mustPassCaseIds`);
    for (const documentId of expectedDocumentIds) {
      if (claimedDocuments.has(documentId)) throw new Error(`Duplicate expected document ownership: ${documentId}.`);
      claimedDocuments.add(documentId);
    }
    const mappedCases: EvaluationCase[] = [];
    for (const caseId of mustPassCaseIds) {
      if (claimedCases.has(caseId)) throw new Error(`Duplicate must-pass case ownership: ${caseId}.`);
      claimedCases.add(caseId);
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
    const parsedRecord = { key, owner, reviewStatus, expectedDocumentIds, mustPassCaseIds };
    expectedDocumentsByCase.set(
      parsedRecord,
      new Map(
        mappedCases.map((testCase) => [
          testCase.id,
          expectedDocumentIds.filter((documentId) => testCase.expectedDocuments.includes(documentId)),
        ]),
      ),
    );
    return parsedRecord;
  });
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
  return [...args.expected]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((entry) => {
      let outcome: SourceCoverageFinding["outcome"];
      if (entry.reviewStatus === "retired") outcome = "retired";
      else if (entry.reviewStatus === "not_approved") outcome = "not_approved";
      else {
        const allExpectedActive =
          entry.reviewStatus === "active" &&
          entry.expectedDocumentIds.length > 0 &&
          entry.expectedDocumentIds.every((documentId) => args.activeDocumentIds.has(documentId));
        if (!allExpectedActive) outcome = "not_in_corpus";
        else {
          const retrievalMiss = entry.mustPassCaseIds.some((caseId) => {
            const retrieved = args.retrievedDocumentIdsByCase.get(caseId);
            const expectedForCase = expectedDocumentsByCase.get(entry)?.get(caseId) ?? entry.expectedDocumentIds;
            return !retrieved || expectedForCase.some((documentId) => !retrieved.has(documentId));
          });
          outcome = retrievalMiss ? "retrieval_miss" : "available";
        }
      }
      return { key: entry.key, outcome, owner: entry.owner, mustPassCaseIds: [...entry.mustPassCaseIds].sort() };
    });
}
