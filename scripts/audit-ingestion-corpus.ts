import { createHash } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { australianSourceCatalogue } from "@/lib/australian-source-catalogue";
import {
  auditDocument,
  INGESTION_FAILED_EXPECTATION_CODES,
  type IngestionDocumentAuditInput,
} from "@/lib/ingestion-audit";
import { ragProgrammeFixture } from "@/lib/rag/rag-programme-eval";
import { auditExpectedSourceCoverage, parseExpectedSourceCoverageRegistry } from "@/lib/source-coverage-registry";
import { isRegistryProjectionDocument } from "./lib/indexing-health-document";

type Inventory = {
  schemaVersion: 1;
  documents: IngestionDocumentAuditInput[];
  retrievalCases: Array<{ id: string; retrievedDocumentIds: string[] }>;
};

const MAX_BYTES = 2_000_000;
const MAX_DOCUMENTS = 5_000;
const MAX_CASES = 1_000;
const MAX_ARRAY = 5_000;
const MAX_FAILED_EXPECTATIONS = 32;
const failedExpectationCodes = new Set<string>(INGESTION_FAILED_EXPECTATION_CODES);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field ${unexpected.sort()[0]}.`);
}

function text(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error(`${label} must be bounded text.`);
  return value.trim();
}

function count(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10_000_000)
    throw new Error(`${label} must be a bounded non-negative integer.`);
  return value;
}

function booleanOrNull(value: unknown, label: string): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new Error(`${label} must be boolean or null.`);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY) throw new Error(`${label} must be a bounded array.`);
  const result = value.map((item, index) => text(item, `${label}[${index}]`) as string);
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate values.`);
  return result.sort();
}

function failureCodeArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_FAILED_EXPECTATIONS)
    throw new Error(`${label} must be a bounded array of failed expectation codes.`);
  const result = value.map((item, index) => text(item, `${label}[${index}]`) as string);
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate values.`);
  if (result.some((code) => !failedExpectationCodes.has(code)))
    throw new Error(`${label} contains an unsupported failed expectation code.`);
  return result.sort();
}

const DOCUMENT_FIELDS = [
  "documentId",
  "fileName",
  "metadata",
  "integrityExpectation",
  "activeGenerationId",
  "lifecycle",
  "governanceValid",
  "publisher",
  "pageCount",
  "indexedPageCount",
  "chunkCount",
  "tableCount",
  "imageCount",
  "searchableUnitCount",
  "embeddingCount",
  "duplicateChunks",
  "orphanedArtifacts",
  "emptyIndexUnits",
  "oversizedIndexUnits",
  "undersizedIndexUnits",
  "lowInformationIndexUnits",
  "chunkBoundsValid",
  "headingContinuityPassed",
  "tableContinuityPassed",
  "extractionQuality",
  "embeddingModel",
  "embeddingDimensions",
  "embeddingStrategy",
  "chunkGenerations",
  "mustPassCases",
] as const;

function parseDocument(value: unknown, index: number): IngestionDocumentAuditInput {
  const label = `documents[${index}]`;
  const raw = object(value, label);
  exactKeys(raw, DOCUMENT_FIELDS, label);
  const expectationRaw =
    raw.integrityExpectation === null ? null : object(raw.integrityExpectation, `${label}.integrityExpectation`);
  if (expectationRaw)
    exactKeys(
      expectationRaw,
      [
        "pages",
        "chunks",
        "tables",
        "images",
        "searchableUnits",
        "embeddings",
        "unitQualityPolicyVersion",
        "embeddingModel",
        "embeddingDimensions",
        "embeddingStrategy",
      ],
      `${label}.integrityExpectation`,
    );
  const lifecycle = text(raw.lifecycle, `${label}.lifecycle`) as IngestionDocumentAuditInput["lifecycle"];
  if (!new Set(["active", "quarantined", "withdrawn", "superseded"]).has(lifecycle))
    throw new Error(`${label}.lifecycle is invalid.`);
  const extractionQuality = raw.extractionQuality;
  if (extractionQuality !== null && extractionQuality !== "acceptable" && extractionQuality !== "poor")
    throw new Error(`${label}.extractionQuality is invalid.`);
  if (typeof raw.governanceValid !== "boolean") throw new Error(`${label}.governanceValid must be boolean.`);
  const metadata = object(raw.metadata, `${label}.metadata`);
  exactKeys(metadata, ["source_kind", "registry_record_id"], `${label}.metadata`);
  const mustPassRaw = raw.mustPassCases;
  if (!Array.isArray(mustPassRaw) || mustPassRaw.length > MAX_CASES)
    throw new Error(`${label}.mustPassCases must be bounded.`);
  const mustPassCases = mustPassRaw.map((item, caseIndex) => {
    const itemLabel = `${label}.mustPassCases[${caseIndex}]`;
    const testCase = object(item, itemLabel);
    exactKeys(
      testCase,
      ["id", "passed", "expectedDocumentRank", "actualDocumentRank", "failedExpectations"],
      itemLabel,
    );
    if (typeof testCase.passed !== "boolean") throw new Error(`${itemLabel}.passed must be boolean.`);
    return {
      id: text(testCase.id, `${itemLabel}.id`) as string,
      passed: testCase.passed,
      expectedDocumentRank: count(testCase.expectedDocumentRank, `${itemLabel}.expectedDocumentRank`, true),
      actualDocumentRank: count(testCase.actualDocumentRank, `${itemLabel}.actualDocumentRank`, true),
      failedExpectations: failureCodeArray(testCase.failedExpectations, `${itemLabel}.failedExpectations`),
    };
  });
  return {
    documentId: text(raw.documentId, `${label}.documentId`) as string,
    fileName: text(raw.fileName, `${label}.fileName`, true),
    metadata,
    registryProjection: isRegistryProjectionDocument({
      status: "indexed",
      file_name: raw.fileName === null ? null : (text(raw.fileName, `${label}.fileName`) as string),
      page_count: count(raw.indexedPageCount, `${label}.indexedPageCount`, true),
      chunk_count: count(raw.chunkCount, `${label}.chunkCount`) as number,
      metadata,
    }),
    integrityExpectation: expectationRaw
      ? {
          pages: count(expectationRaw.pages, `${label}.integrityExpectation.pages`, true),
          chunks: count(expectationRaw.chunks, `${label}.integrityExpectation.chunks`, true),
          tables: count(expectationRaw.tables, `${label}.integrityExpectation.tables`, true),
          images: count(expectationRaw.images, `${label}.integrityExpectation.images`, true),
          searchableUnits: count(expectationRaw.searchableUnits, `${label}.integrityExpectation.searchableUnits`, true),
          embeddings: count(expectationRaw.embeddings, `${label}.integrityExpectation.embeddings`, true),
          unitQualityPolicyVersion: text(
            expectationRaw.unitQualityPolicyVersion,
            `${label}.integrityExpectation.unitQualityPolicyVersion`,
          ) as string,
          embeddingModel: text(expectationRaw.embeddingModel, `${label}.integrityExpectation.embeddingModel`) as string,
          embeddingDimensions: count(
            expectationRaw.embeddingDimensions,
            `${label}.integrityExpectation.embeddingDimensions`,
          ) as number,
          embeddingStrategy: text(
            expectationRaw.embeddingStrategy,
            `${label}.integrityExpectation.embeddingStrategy`,
          ) as string,
        }
      : null,
    activeGenerationId: text(raw.activeGenerationId, `${label}.activeGenerationId`, true),
    lifecycle,
    governanceValid: raw.governanceValid,
    publisher: text(raw.publisher, `${label}.publisher`, true),
    pageCount: count(raw.pageCount, `${label}.pageCount`, true),
    indexedPageCount: count(raw.indexedPageCount, `${label}.indexedPageCount`, true),
    chunkCount: count(raw.chunkCount, `${label}.chunkCount`) as number,
    tableCount: count(raw.tableCount, `${label}.tableCount`) as number,
    imageCount: count(raw.imageCount, `${label}.imageCount`) as number,
    searchableUnitCount: count(raw.searchableUnitCount, `${label}.searchableUnitCount`) as number,
    embeddingCount: count(raw.embeddingCount, `${label}.embeddingCount`) as number,
    duplicateChunks: count(raw.duplicateChunks, `${label}.duplicateChunks`) as number,
    orphanedArtifacts: count(raw.orphanedArtifacts, `${label}.orphanedArtifacts`) as number,
    emptyIndexUnits: count(raw.emptyIndexUnits, `${label}.emptyIndexUnits`) as number,
    oversizedIndexUnits: count(raw.oversizedIndexUnits, `${label}.oversizedIndexUnits`) as number,
    undersizedIndexUnits: count(raw.undersizedIndexUnits, `${label}.undersizedIndexUnits`) as number,
    lowInformationIndexUnits: count(raw.lowInformationIndexUnits, `${label}.lowInformationIndexUnits`) as number,
    chunkBoundsValid: booleanOrNull(raw.chunkBoundsValid, `${label}.chunkBoundsValid`),
    headingContinuityPassed: booleanOrNull(raw.headingContinuityPassed, `${label}.headingContinuityPassed`),
    tableContinuityPassed: booleanOrNull(raw.tableContinuityPassed, `${label}.tableContinuityPassed`),
    extractionQuality,
    embeddingModel: text(raw.embeddingModel, `${label}.embeddingModel`, true),
    embeddingDimensions: count(raw.embeddingDimensions, `${label}.embeddingDimensions`, true),
    embeddingStrategy: text(raw.embeddingStrategy, `${label}.embeddingStrategy`, true),
    chunkGenerations: stringArray(raw.chunkGenerations, `${label}.chunkGenerations`),
    mustPassCases,
  };
}

function parseInventory(value: unknown): Inventory {
  const root = object(value, "Inventory");
  exactKeys(root, ["schemaVersion", "documents", "retrievalCases"], "Inventory");
  if (root.schemaVersion !== 1) throw new Error("Inventory schemaVersion must be 1.");
  if (!Array.isArray(root.documents) || root.documents.length > MAX_DOCUMENTS)
    throw new Error("Inventory documents must be a bounded array.");
  if (!Array.isArray(root.retrievalCases) || root.retrievalCases.length > MAX_CASES)
    throw new Error("Inventory retrievalCases must be a bounded array.");
  const documents = root.documents
    .map(parseDocument)
    .sort((left, right) => left.documentId.localeCompare(right.documentId));
  if (new Set(documents.map(({ documentId }) => documentId)).size !== documents.length)
    throw new Error("Inventory contains duplicate documentId values.");
  const retrievalCases = root.retrievalCases
    .map((item, index) => {
      const raw = object(item, `retrievalCases[${index}]`);
      exactKeys(raw, ["id", "retrievedDocumentIds"], `retrievalCases[${index}]`);
      return {
        id: text(raw.id, `retrievalCases[${index}].id`) as string,
        retrievedDocumentIds: stringArray(raw.retrievedDocumentIds, `retrievalCases[${index}].retrievedDocumentIds`),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(retrievalCases.map(({ id }) => id)).size !== retrievalCases.length)
    throw new Error("Inventory contains duplicate retrieval case ids.");
  return { schemaVersion: 1, documents, retrievalCases };
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  let liveRead = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    if (flag === "--live-read") {
      liveRead = true;
      continue;
    }
    if (!["--input", "--expected", "--output", "--confirm-target", "--authorization-receipt"].includes(flag))
      throw new Error(`Unknown argument: ${flag}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    if (values.has(flag)) throw new Error(`${flag} may be supplied only once.`);
    values.set(flag, value);
    index += 1;
  }
  if (liveRead) {
    if (!values.get("--confirm-target") || !values.get("--authorization-receipt"))
      throw new Error("--live-read requires explicit target confirmation and a provider authorization receipt.");
    throw new Error("No live-read adapter is installed; this command remains provider-free and read-only.");
  }
  for (const flag of ["--input", "--expected", "--output"])
    if (!values.get(flag)) throw new Error(`${flag} is required for the offline audit.`);
  if (values.has("--confirm-target") || values.has("--authorization-receipt"))
    throw new Error("Live target arguments are valid only with --live-read.");
  return {
    input: values.get("--input")!,
    expected: values.get("--expected")!,
    output: values.get("--output")!,
  };
}

async function readBoundedJson(filePath: string) {
  const handle = await open(filePath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`${filePath} must be a regular audit input file.`);
    if (stats.size > MAX_BYTES) throw new Error(`${filePath} exceeds the audit input size limit.`);
    const source = Buffer.alloc(stats.size);
    let offset = 0;
    while (offset < source.length) {
      const { bytesRead } = await handle.read(source, offset, source.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    const { bytesRead: extraBytesRead } = await handle.read(extra, 0, 1, offset);
    if (extraBytesRead > 0) throw new Error(`${filePath} changed while the bounded audit input was read.`);
    return JSON.parse(source.subarray(0, offset).toString("utf8")) as unknown;
  } finally {
    await handle.close();
  }
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function runOfflineIngestionAudit(argv: string[]) {
  const args = parseArgs(argv);
  const inventory = parseInventory(await readBoundedJson(args.input));
  const expected = parseExpectedSourceCoverageRegistry(await readBoundedJson(args.expected), {
    catalogue: australianSourceCatalogue,
    evaluationCases: ragProgrammeFixture.cases,
  });
  const retrievedDocumentIdsByCase = new Map(
    inventory.retrievalCases.map(({ id, retrievedDocumentIds }) => [id, new Set(retrievedDocumentIds)]),
  );
  const documents = inventory.documents
    .map(auditDocument)
    .sort((left, right) => left.documentId.localeCompare(right.documentId));
  const auditByDocumentId = new Map(documents.map((document) => [document.documentId, document]));
  const activeDocumentIds = new Set(
    inventory.documents
      .filter(
        (document) =>
          document.lifecycle === "active" &&
          document.governanceValid &&
          document.integrityExpectation !== null &&
          !document.registryProjection &&
          auditByDocumentId.get(document.documentId)?.eligibleForShadowPlan === true,
      )
      .map(({ documentId }) => documentId),
  );
  const sourceCoverage = auditExpectedSourceCoverage({
    expected: expected.records,
    activeDocumentIds,
    retrievedDocumentIdsByCase,
  });
  const populationFingerprint = `sha256:${createHash("sha256")
    .update(JSON.stringify({ documents, sourceCoverage }))
    .digest("hex")}`;
  const report = {
    schemaVersion: 1,
    mode: "offline_read_only",
    populationFingerprint,
    documents,
    expectedSourceCoverage: sourceCoverage,
  } as const;
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, stableJson(report), { encoding: "utf8", flag: "w" });
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOfflineIngestionAudit(process.argv.slice(2))
    .then((report) => {
      console.log(
        `INGESTION AUDIT READY: ${report.documents.length} documents; ${report.expectedSourceCoverage.length} source records; ${report.populationFingerprint}.`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
