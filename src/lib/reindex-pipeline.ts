export type ReindexQueueSnapshot = {
  openJobs: number;
  queuedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
};

export type AbandonedReindexGenerationCounts = {
  document_chunks?: number;
  document_images?: number;
  document_table_facts?: number;
  document_embedding_fields?: number;
  document_index_units?: number;
  document_memory_cards?: number;
  document_sections?: number;
};

export type DocumentGenerationPromotionIdentity = Readonly<{
  kind: "document_generation";
  documentId: string;
  generationId: string;
  generationDigest: string;
  previousGenerationId: string;
  previousGenerationDigest: string;
}>;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const documentGenerationPromotionIdentityKeys = [
  "documentId",
  "generationDigest",
  "generationId",
  "kind",
  "previousGenerationDigest",
  "previousGenerationId",
];

function requiredBoundedIdentity(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200 || value.trim() !== value) {
    throw new Error(`${field} must be a non-empty bounded identity.`);
  }
  return value;
}

export function assertDocumentGenerationPromotionIdentity(value: unknown): DocumentGenerationPromotionIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Document generation promotion identity must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\n") !== documentGenerationPromotionIdentityKeys.join("\n")) {
    throw new Error("Document generation promotion identity has missing or unsupported fields.");
  }
  if (record.kind !== "document_generation") {
    throw new Error("Document generation promotion identity kind is invalid.");
  }
  requiredBoundedIdentity(record.documentId, "documentId");
  const generationId = requiredBoundedIdentity(record.generationId, "generationId");
  const previousGenerationId = requiredBoundedIdentity(record.previousGenerationId, "previousGenerationId");
  if (generationId === previousGenerationId) {
    throw new Error("Current and previous generation identities must be distinct.");
  }
  if (typeof record.generationDigest !== "string" || !SHA256_PATTERN.test(record.generationDigest)) {
    throw new Error("generationDigest must be a lowercase SHA-256 digest.");
  }
  if (typeof record.previousGenerationDigest !== "string" || !SHA256_PATTERN.test(record.previousGenerationDigest)) {
    throw new Error("previousGenerationDigest must be a lowercase SHA-256 digest.");
  }
  return value as DocumentGenerationPromotionIdentity;
}

export function isReindexQueueClear(snapshot: ReindexQueueSnapshot) {
  return (
    snapshot.openJobs === 0 &&
    snapshot.queuedDocuments === 0 &&
    snapshot.processingDocuments === 0 &&
    snapshot.failedDocuments === 0
  );
}

export function hasIncompleteDocumentsWithoutOpenJobs(snapshot: ReindexQueueSnapshot) {
  return (
    snapshot.openJobs === 0 &&
    snapshot.queuedDocuments === 0 &&
    (snapshot.processingDocuments > 0 || snapshot.failedDocuments > 0)
  );
}

export function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
}

export function committedIndexGeneration(metadata: unknown) {
  const generation = metadataRecord(metadata).index_generation_id;
  return typeof generation === "string" && generation.trim() ? generation.trim() : null;
}

export function isAtomicReindexCandidate(document: { status?: string | null; metadata?: unknown }) {
  return document.status === "indexed";
}

export function isCommittedGenerationMetadata(args: { rowMetadata?: unknown; committedGeneration?: string | null }) {
  const rowGeneration = committedIndexGeneration(args.rowMetadata);
  if (!rowGeneration) return true;
  if (!args.committedGeneration) return true;
  return rowGeneration === args.committedGeneration;
}

export function imageRowNeedsGenerationRestamp(args: {
  indexGenerationId: string | null;
  metadata: unknown;
  committedGeneration: string;
}) {
  if (args.indexGenerationId !== args.committedGeneration) return true;
  return committedIndexGeneration(args.metadata) !== args.committedGeneration;
}

export function isAbandonedStagedGeneration(args: {
  rowMetadata?: unknown;
  rowGenerationId?: string | null;
  committedGeneration?: string | null;
}) {
  const rowGeneration =
    typeof args.rowGenerationId === "string" && args.rowGenerationId.trim()
      ? args.rowGenerationId.trim()
      : committedIndexGeneration(args.rowMetadata);
  if (!rowGeneration) return false;
  return rowGeneration !== (args.committedGeneration ?? null);
}

export function abandonedReindexGenerationTotal(counts: AbandonedReindexGenerationCounts) {
  return Object.values(counts).reduce((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

export function hasAbandonedReindexGenerations(counts: AbandonedReindexGenerationCounts) {
  return abandonedReindexGenerationTotal(counts) > 0;
}
