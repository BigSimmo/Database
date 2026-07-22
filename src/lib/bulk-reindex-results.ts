type BulkReindexResult = {
  ok?: unknown;
};

type BulkReindexPayload = {
  results?: unknown;
  missingDocumentIds?: unknown;
};

export type BulkReindexSummary = {
  succeeded: number;
  failed: number;
  hasSuccessfulWork: boolean;
  message: string;
};

export function summarizeBulkReindexPayload(payload: unknown): BulkReindexSummary {
  const record = payload && typeof payload === "object" ? (payload as BulkReindexPayload) : {};
  const results = Array.isArray(record.results) ? (record.results as BulkReindexResult[]) : [];
  const missingDocumentIds = Array.isArray(record.missingDocumentIds) ? record.missingDocumentIds : [];
  const succeeded = results.filter((result) => result?.ok === true).length;
  const failed = results.filter((result) => result?.ok !== true).length + missingDocumentIds.length;

  return {
    succeeded,
    failed,
    hasSuccessfulWork: succeeded > 0,
    message:
      succeeded + failed > 0
        ? `Bulk reindex: ${succeeded} queue request${succeeded === 1 ? "" : "s"} succeeded; ${failed} failed.`
        : "Bulk reindex completed without per-document results.",
  };
}
