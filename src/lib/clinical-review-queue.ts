type JsonRecord = Record<string, unknown>;

export type ClinicalReviewQueueEntry = {
  key: string;
  document_id: string | null;
  title: string;
  file_name: string;
  top_result_slots: number;
  case_ids: string[];
  reasons: string[];
  observed: {
    document_statuses: string[];
    clinical_validation_statuses: string[];
    extraction_qualities: string[];
  };
};

export type ClinicalReviewQueue = {
  version: "clinical-review-queue-v1";
  source_generated_at: string | null;
  status_change_policy: string;
  entry_count: number;
  entries: ClinicalReviewQueueEntry[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedIdentity(value: string) {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function retrievalResults(input: unknown) {
  const root = record(input);
  const retrieval = record(root?.retrieval);
  const candidates = retrieval?.results ?? root?.results ?? (Array.isArray(input) ? input : null);
  if (!Array.isArray(candidates)) throw new Error("Eval JSON must contain retrieval.results or a results array.");
  return candidates.map(record).filter((item): item is JsonRecord => item !== null);
}

function topResults(result: JsonRecord) {
  return Array.isArray(result.topResults)
    ? result.topResults.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function reviewReasons(result: JsonRecord) {
  const status = text(result.document_status) ?? "unknown";
  const validation = text(result.clinical_validation_status) ?? "unverified";
  const extraction = text(result.extraction_quality) ?? "unknown";
  const reasons: string[] = [];
  if (["outdated", "review_due", "unknown"].includes(status)) reasons.push(`document_status:${status}`);
  if (validation === "unverified") reasons.push("clinical_validation_status:unverified");
  if (["unknown", "poor"].includes(extraction)) reasons.push(`extraction_quality:${extraction}`);
  return { status, validation, extraction, reasons };
}

/** Build a deterministic, deduplicated work queue from an eval-quality JSON
 * report. The queue only records observed states and review reasons; it never
 * proposes or writes a replacement governance status. */
export function buildClinicalReviewQueue(input: unknown): ClinicalReviewQueue {
  const root = record(input);
  const results = retrievalResults(input);
  const documentIdByFileName = new Map<string, string>();
  for (const result of results) {
    for (const source of topResults(result)) {
      const fileName = text(source.file_name);
      const documentId = text(source.document_id);
      if (fileName && documentId) documentIdByFileName.set(normalizedIdentity(fileName), documentId);
    }
  }

  type QueueAccumulator = {
    documentId: string | null;
    title: string;
    fileName: string;
    slots: number;
    caseIds: Set<string>;
    reasons: Set<string>;
    statuses: Set<string>;
    validations: Set<string>;
    extractions: Set<string>;
  };
  const queue = new Map<string, QueueAccumulator>();

  for (const [caseIndex, result] of results.entries()) {
    const caseId = text(result.id) ?? `case-${caseIndex + 1}`;
    for (const source of topResults(result)) {
      const governance = reviewReasons(source);
      if (governance.reasons.length === 0) continue;
      const sourceFileName = text(source.file_name);
      const fileName = sourceFileName ?? "unknown";
      const title = text(source.title) ?? fileName;
      const documentId = text(source.document_id) ?? documentIdByFileName.get(normalizedIdentity(fileName)) ?? null;
      const key = documentId
        ? `document:${documentId}`
        : sourceFileName
          ? `file:${normalizedIdentity(sourceFileName)}`
          : `title:${normalizedIdentity(title)}`;
      const current = queue.get(key) ?? {
        documentId,
        title,
        fileName,
        slots: 0,
        caseIds: new Set<string>(),
        reasons: new Set<string>(),
        statuses: new Set<string>(),
        validations: new Set<string>(),
        extractions: new Set<string>(),
      };
      current.slots += 1;
      current.caseIds.add(caseId);
      for (const reason of governance.reasons) current.reasons.add(reason);
      current.statuses.add(governance.status);
      current.validations.add(governance.validation);
      current.extractions.add(governance.extraction);
      queue.set(key, current);
    }
  }

  const entries = [...queue.entries()]
    .map(([key, item]): ClinicalReviewQueueEntry => ({
      key,
      document_id: item.documentId,
      title: item.title,
      file_name: item.fileName,
      top_result_slots: item.slots,
      case_ids: [...item.caseIds].sort(),
      reasons: [...item.reasons].sort(),
      observed: {
        document_statuses: [...item.statuses].sort(),
        clinical_validation_statuses: [...item.validations].sort(),
        extraction_qualities: [...item.extractions].sort(),
      },
    }))
    .sort(
      (left, right) =>
        right.top_result_slots - left.top_result_slots ||
        compareText(left.file_name, right.file_name) ||
        compareText(left.key, right.key),
    );

  return {
    version: "clinical-review-queue-v1",
    source_generated_at: text(root?.generated_at),
    status_change_policy:
      "Clinical evidence must be reviewed before document_status or clinical_validation_status changes; this queue never auto-promotes either status.",
    entry_count: entries.length,
    entries,
  };
}
