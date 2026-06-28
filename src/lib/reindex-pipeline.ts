export type ReindexQueueSnapshot = {
  openJobs: number;
  queuedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
};

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

export function isCommittedGenerationMetadata(args: {
  rowMetadata?: unknown;
  committedGeneration?: string | null;
}) {
  const rowGeneration = committedIndexGeneration(args.rowMetadata);
  if (!rowGeneration) return true;
  return Boolean(args.committedGeneration) && rowGeneration === args.committedGeneration;
}
